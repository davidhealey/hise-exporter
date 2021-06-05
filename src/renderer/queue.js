const utils = require('./utils.js');
const settings = require('./settings.js');
const prj = require('./index.js');
const log = require('electron-log');
const path = require('path');
const fs = require('fs-extra');
const packager = require('./packager.js');
const codesign = require('./codesign.js');
const builder = require("./hise-builder.js"); //Compile/build

console.log = log.log;

let cancel = false; //Track status of cancel button
let job_list = [];
let currentJob; //Index of job currently being processed
let totalJobs; //Total number of jobs to be processed (not always the same as job_list.length)

exports.getCurrentJob = function() {
  return currentJob;
};

exports.getTotalJobs = function() {
  return totalJobs();
};

//Cancel button
document.getElementById("cancel").addEventListener("click", () => {
  stopQueue();
  console.log("Queue Cancelled");
});

function stopQueue() {
  cancel = true;

  if (builder.getChildProcess() != undefined)
    builder.killChild();

  if (codesign.getChildProcess() != undefined)
    codesign.killChild();

  //Hide spinner and cancel button
  let sections = document.querySelectorAll(".uk-section");
  sections[0].style.display = "block";
  sections[1].style.display = "none";

  //Clear status messages
  document.getElementById("export-status-message").innerText = "";
}

//Export button
document.querySelector('button#export').addEventListener('click', e => {

  //Simple validation
  if (job_list.length == 0) {
    utils.notify("No jobs in queue");
    return false;
  }

  //Reset cancel state
  cancel = false;

  //Clear logfile
  log.transports.file.clear();

  //Close all open notifications
  UIkit.notification.closeAll();

  //Show spinner and cancel button
  let sections = document.querySelectorAll(".uk-section");
  sections[0].style.display = "none";
  sections[1].style.display = "block";

  processQueue();
});

async function processQueue() {

  try {
    let queue = document.querySelectorAll("#queue tr");
    totalJobs = queue.length;
    let projectNames = []; //Keep a list of project names that have been processed.
    let lastJob = {}; //Keep details of the last job to optimize
    let outputFile = false; //Path to output binaries or installer
    let companyName = settings.getLocalSetting("company-name");

    for (let i = 0; i < queue.length; i++) {

      //Respond to cancel button
      if (cancel) break;

      //Get job index from queue
      let id = queue[i].attributes.jobIndex.value;
      let job = job_list[id];

      currentJob = (i + 1);

      //Create packaging directory
      packager.createPackagingDirectory(job["project-path"]);

      //Run job
      if (job["project-type"] == "installer") { //Installer job
        utils.setExportStatus("Exporting", currentJob, totalJobs, job["project-name"], "Building Installer.");
        switch (process.platform) {
          case "linux":
            outputFile = await packager.packageLinux(job["project-path"], job["project-name"], job["project-version"], companyName, job["license-path"], job["manual-path"], job["post-install-script-path"]);
            break;

          case "darwin":
            outputFile = await packager.packageDarwin(job["project-path"], job["project-name"], job["project-version"], companyName, job["license-path"], job["manual-path"], job["readme-path"], job["post-install-script-path"]);
            break;

          case "win32":
            outputFile = await packager.packageWin32(job["project-path"], job["project-name"], job["project-version"], companyName, job["license-path"], job["manual-path"]);
            break;
        }
      } else { //Compilation job

        //Update project XML - have to do this each time in case VST3 flag changes between jobs
        utils.setExportStatus("Saving Project XML", currentJob, totalJobs, job["project-name"], "");

        let xmlData = {};
        xmlData.Name = document.querySelector("input#project-name").value;
        xmlData.Version = document.querySelector("input#project-version").value;
        xmlData.VST3Support = job["plugin-format"] == "VST3" && process.platform != "linux"; //Set VST3 flag (disable on linux)

        updateProjectInfoXml(job["project-path"], xmlData);

        //Setup HISE
        if (!cancel && lastJob["project-name"] != job["project-name"]) {
          utils.setExportStatus("Exporting", currentJob, totalJobs, job["project-name"], "Prepping Build.");
          builder.setHISEFolder(job["hise-exec"], job["hise-path"]);
          builder.setProjectFolder(job["hise-exec"], job["project-path"]);
          builder.setProjectVersion(job["hise-exec"], job["project-version"]);
        }

        //Clean build directory
        if (!cancel && (lastJob["project-name"] != job["project-name"] || lastJob["project-type"] != job["project-type"])) {
          utils.setExportStatus("Exporting", currentJob, totalJobs, job["project-name"], "Cleaning Build Directory.");
          await builder.cleanBuildDirectory(job["hise-exec"], job["project-path"]);
        }

        //Export HISE project
        if (!cancel) {
          utils.setExportStatus("Exporting", currentJob, totalJobs, job["project-name"], "Running HISE Export.");
          await builder.runHISEExport(job["hise-exec"], job["project-path"], job["project-file"], job);
        }

        //Add plugin categories to jucer file 
        if (job["project-type"] != "standalone") {
          addPluginCategoriesToJucerFile(job["project-path"], job["plugin-categories"], job["plugin-format"]);
        }

        //Add company email to jucer file 
        addCompanyEmailToJucerFile(job["project-path"]);

        //Resave Jucer file
        if (!cancel) {
          utils.setExportStatus("Exporting", currentJob, totalJobs, job["project-name"], "Resaving Jucer file.");
          await builder.resaveJucerFile(job["hise-path"], job["project-path"]);
        }

        //Build binary
        if (!cancel) {
          utils.setExportStatus("Exporting", currentJob, totalJobs, job["project-name"], "Compiling Binary.");
          await builder.build(job["project-path"], job["arch"]);
        }

        //Copy binary to packaging
        if (!cancel) {
          utils.setExportStatus("Exporting", currentJob, totalJobs, job["project-name"], "Copying binary to packaging folder");
          let dirs = getBinaryOriginAndDestination(job);
          console.log(dirs.origin, dirs.destination);
          await fs.copy(dirs.origin, dirs.destination);
          outputFile = dirs.destination; //Return path to copied binary
        }

        //Copy rlottie libraries to packaging if required
        if (job["rlottie"])
          await packager.copyRlottieLibraries(job["project-path"]);
      }

      //Handle codesigning/notarization on MacOS
      if (!cancel && outputFile && process.platform == "darwin") {
        if (job["codesign"]) {
          utils.setExportStatus("Signing", currentJob, totalJobs, job["project-name"], "");
          outputFile = await doCodesign(outputFile, job["project-type"]);
        }

        if (job["notarize"]) {
          utils.setExportStatus("Notarizing", currentJob, totalJobs, job["project-name"], "Uploading: This could take a while...");
          await doNotarize(outputFile, job["bundle-id"]);
        }
      }

      //Make a record of project's name
      projectNames.push(job["project-name"]);

      //Keep a record of the last job
      lastJob = job;

      //Remove job from queue
      if (!cancel) {
        queue[i].remove();
        delete job_list[id];
      }
    } //for loop
  } catch (err) {
    stopQueue();
    console.log("EXPORT ABORTED:", err);
  }

  stopQueue();
  console.log("EXPORT FINISHED");
}

function getBinaryOriginAndDestination(job) {
  //Get binary extension based on build args
  let ext = builder.getBinaryExtension(job["project-type"], job["plugin-format"]);

  //Get current binary name
  let oldName = builder.getOutputName(job["project-name"], job["arch"]);

  //Get new binary name
  let newName = builder.getNewFilename(oldName, job["ipp"], job["legacy-cpu"]);

  //Get current and new path
  let oldPath = builder.getOutputDirectory(job["project-path"], job["project-type"], job["plugin-format"]);
  let newPath = packager.getPackagingDirectory(job["project-path"]);

  //Assemble full path + name + extension
  let origin = path.join(oldPath, oldName) + ext;
  let destination = path.join(newPath, newName) + ext;

  return {
    "origin": origin,
    "destination": destination
  };
}

//Add job to queue and update queue table
exports.addJob = function(data) {

  if (!jobExists(data))
    job_list.push(data);
  else {
    utils.notify("Same job is already in queue");
    return false;
  }

  let index = job_list.indexOf(data);

  //Add entry to queue table
  let entry = formatTableEntry(data);
  let tbody = document.getElementById("queue");

  //Build table row for job
  let tr = document.createElement("tr");
  tr.className = "uk-sortable-handle uk-box-shadow-hover-small";
  tr.setAttribute("jobIndex", index);

  for (let i = 0; i < entry.length; i++) {
    let td = document.createElement("td");

    if (typeof entry[i] == "boolean") {
      let span = document.createElement("span");
      entry[i] ? span.setAttribute("uk-icon", "icon: check") : span.setAttribute("uk-icon", "icon: close");
      td.appendChild(span);
    } else
      td.innerText = entry[i];

    tr.appendChild(td);
  }

  //Add delete button
  let td = document.createElement("td");
  let a = document.createElement("a");
  a.className = "queue-delete";
  a.setAttribute("href", "#");
  a.setAttribute("uk-icon", "icon: trash");
  a.addEventListener("click", removeJob);

  td.appendChild(a);
  tr.appendChild(td);
  tbody.appendChild(tr);

  //utils.notify user
  utils.notify("Added Job For " + entry[0]);
};

function removeJob(e) {
  let tr = this.closest("tr");
  let index = tr.attributes.jobIndex.value;
  delete job_list[index];
  tr.remove();
}

function formatTableEntry(data) {

  let result = [];

  //Gather data
  result[0] = data["project-name"];

  //Project type
  if (data["project-type"] == "standalone" || data["project-type"] == "installer")
    result[1] = data["project-type"].charAt(0).toUpperCase() + data["project-type"].slice(1);
  else
    result[1] = data["plugin-format"];

  //Architecture  
  result[2] = data["arch"] || "N/A";

  data["legacy-cpu"] ? result[3] = true : result[3] = false;
  data["ipp"] ? result[4] = true : result[4] = false;
  data["rlottie"] ? result[5] = true : result[5] = false;

  return result;
}

//Check if a job with the same settings is already in the queue
function jobExists(data) {

  let result = false;

  for (i = 0; i < job_list.length; i++) {
    result = JSON.stringify(data) === JSON.stringify(job_list[i]);

    if (result)
      break;
  }
  return result;
}

function doNotarize(pkg, bundle_id) {
  return new Promise(async function(resolve, reject) {
    let apple_id = settings.getLocalSetting("apple-id");
    let app_specific_password = await settings.getAppSpecificPassword();

    if (apple_id && app_specific_password) {
      let uuid = await codesign.notarizeInstaller(pkg, bundle_id, apple_id, app_specific_password);

      if (uuid) {
        await codesign.stapleInstaller(pkg, uuid, apple_id, app_specific_password);
        resolve();
      }
      resolve();
    }
    utils.notify("Notarization Failed, check log file for details.");
    reject("Notarization unsuccessful.");
  });
}

function doCodesign(file, project_type) {
  return new Promise(async function(resolve, reject) {
    let team_id = settings.getLocalSetting("apple-team-id");

    if (project_type != "installer") {
      await codesign.signBinary(team_id, file);
      resolve();
    } else {
      let outputFile = file.replace("unsigned", "signed");
      await codesign.signInstaller(team_id, file, outputFile);
      fs.removeSync(file); //Delete unsigned version
      resolve(outputFile);
    }
  }).catch((err) => {
    console.log(err);
  });
}

function addPluginCategoriesToJucerFile(project_path, categories, format) {

  let xmlPath = path.join(project_path, "Binaries", "AutogeneratedProject.jucer");
  let xmlObj = utils.readXml(xmlPath);

  let attributes = xmlObj.elements[0].attributes;

  switch (format) {
    case "VST2": //VST2 can only have a single category
      attributes["pluginVSTCategory"] = categories;
      break;

    case "VST3":
      attributes["pluginVST3Category"] = categories.join();
      break;

    case "AAX":
      attributes["pluginAAXCategory"] = categories.join();
      break;
  }
  utils.writeXml(xmlPath, xmlObj);
}

function addCompanyEmailToJucerFile(project_path) {

  let email = window.localStorage.getItem("company-email");

  if (email) {
    let xmlPath = path.join(project_path, "Binaries", "AutogeneratedProject.jucer");
    let xmlObj = utils.readXml(xmlPath);

    let attributes = xmlObj.elements[0].attributes;
    attributes["companyEmail"] = email;

    utils.writeXml(xmlPath, xmlObj);
  }
}

function updateProjectInfoXml(project_path, data) {

  let xmlPath = path.join(project_path, "project_info.xml");
  let xmlObj = utils.readXml(xmlPath);

  for (let key in data) {

    let found = false;
    let value = data[key];
    if (typeof value == "boolean") value = value ? 1 : 0;

    for (let element of xmlObj.elements[0].elements) {

      if (element.name == key) {
        element.attributes.value = value;
        console.log("Setting project xml:", key, value);

        found = true;
        break;
      }
    }

    //Key not found, add new key/value
    if (!found) {
      let element = {
        type: "element",
        name: key,
        attributes: {
          "value": value
        }
      };
      xmlObj.elements[0].elements.push(element);
    }
  }

  //Update the xml file
  utils.writeXml(xmlPath, xmlObj);
}
exports.updateProjectInfoXml = updateProjectInfoXml;