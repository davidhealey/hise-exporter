const utils = require('./utils.js');
const builder = require("./hise-builder.js"); //Compile/build
const fs = require('fs');
const path = require('path');

let project_xml = {};
let job_list = [];
let cancel = false; //Track status of cancel button

hideControlsOnPlatform();

//Add project button
document.querySelector('button#project-path-browse').addEventListener('click', e => {
  
  document.getElementById("hidden-until-project").style.visibility = "hidden";
  
  let localStorage = window.localStorage;
  let lastProject = localStorage.getItem("last-project") || "";
    
  utils.openDir(lastProject, (response) => {
    
    //Verify selected dir is a HISE project
    let dir = response.filePaths[0];
    let xmlPath = path.join(dir, "project_info.xml"); //Path to project xml

    if (!fs.existsSync(xmlPath)) {
      utils.notify("Not a HISE project folder");
      return false;
    }
    
    //Store the last opened project, used as default for future.
    localStorage.setItem("last-project", dir);
    
    //Populate input with selected path
    document.querySelector("input#project-path").value = dir;
    
    //Populate dropdown with project files and make visible
    addProjectFilesToSelect(dir);
    document.getElementById("hidden-until-project").style.visibility = "visible";

    //Parse project xml
    utils.readXml(xmlPath).then((r) => r)
    .then((result) => {
      project_xml = result;
      document.querySelector("input#project-name").value = project_xml.ProjectSettings.Name[0].$.value;
      document.querySelector("input#project-version").value = project_xml.ProjectSettings.Version[0].$.value;
    });
    
    //Reset poject export settings form
    document.getElementById("job-form").reset();
    
    //Trigger event for project-type selection
    let evt = document.createEvent("HTMLEvents");
    evt.initEvent("change", false, true);
    document.getElementById('project-type').dispatchEvent(evt);
    
    return true;   
  });  
});

//Populate project file select drop down
function addProjectFilesToSelect(project_folder) {

  document.getElementById("hidden-until-xml").style.visibility = "hidden";

  //Add projects to dropdown
  let select = document.querySelector("select#project-file");
  select.innerHTML = "";

  //.xml projects
  fs.readdir(project_folder + "/XmlPresetBackups", (err, files) => {
    if (err) throw(err);
    files.forEach(file => {if (file.includes(".xml")) {addOption(file);}});
  });

  //.hip projects
  fs.readdir(project_folder + "/Presets", (err, files) => {
    if (err) throw(err);
    files.forEach(file => {if (file.includes(".hip")) {addOption(file)}});
    
    if (!select.length)
      utils.notify("There are no XML backups or .hip files in the selected project.");
    else
      document.getElementById("hidden-until-xml").style.visibility = "visible";
  });
  
  function addOption(file) {
    let option = document.createElement("option");
    option.value = file;
    option.innerText = file;
    select.appendChild(option);  
  }  
}

//Job type select
document.querySelector('select#project-type').addEventListener('change', e => {

  let value = e.target.value;
  
  //Reset the form to clear it, but then set the value of the select back to the selection 
  document.getElementById("job-form").reset();
  document.querySelector('select#project-type').value = value;

  document.getElementById("plugin-formats-field").style.display = "none";
  document.getElementById("architecture-field").style.display = "none";
  document.getElementById("features-field").style.display = "none";
  document.getElementById("add-job-field").style.display = "none";

  if (value == "instrument" || value == "effect")
    document.getElementById("plugin-formats-field").style.display = "block";

  if (value == "standalone" || value == "instrument" || value =="effect") {
    document.getElementById("architecture-field").style.display = "block";
    document.getElementById("features-field").style.display = "block";
  }

  if (value != "")
    document.getElementById("add-job-field").style.display = "block";
});

//Add to queue button 
document.querySelector("button#add-to-queue").addEventListener("click", e => {
  let data = parseForms();

  if (data) {
    if (!jobExists(data))
      addJob(data);
    else
      utils.notify("Same job is already in queue");
  }   
});

function parseForms() {
  
  result = {};
  
  //Get all form data 
  let form = document.getElementById("project-form").elements;
  for (let element of form) {
      result[element.id] = element.value;
  }

  form = document.getElementById("job-form").elements;
  for (let element of form) {
    if (element.type == "checkbox" || element.type == "radio") {
      if (element.checked) {
        result[element.name] = result[element.name] || "";
        result[element.name] += element.value;  
      }
    }
    else
      result[element.id] = element.value;
  }  
  
  //Settings form
  form = document.getElementById("settings-form").elements;
  for (let element of form) {
      result[element.id] = element.value;
  }
  
  //Simple validation
  if (result["project-type"] != "installer" && result["hise-path"] == ""){
    utils.notify("HISE path not selected");
    return false;
  }

  if (result["project-path"] == ""){
    utils.notify("No project selected");
    return false;
  }

  if (result["project-type"] != "installer" && result["project-file"] == ""){
    utils.notify("No project XML file selected");
    return false;
  }
  
  if ((result["project-type"] == "instrument" || result["project-type"] == "effect") && !result["plugin-format"]) {
    utils.notify("Plugin format was not specified.");
    return false;
  }

  if (result["project-type"] != "installer" &&  !result["arch"]) {
    utils.notify("Architecture was not specified.");
    return false;
  }

  return result;
}

function formatQueueTableEntry(data) {

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
  
  data["legacy-cpu"] == undefined ? result[3] = false : result[3] = true;
  data["ipp"] == undefined ? result[4] = false : result[4] = true;
  data["rlottie"] == undefined ? result[5] = false : result[5] = true;
  data["debug"] == undefined ? result[6] = false : result[6] = true;
  
  return result;  
}

//Check if a job with the same settings is already in the queue
function jobExists(data) {
  
  let result = false;
  
  for (i = 0; i < job_list.length; i++) {
        
    //Ignore jobs that have been deleted
    if (job_list[i] == null && job_list[i] == undefined) continue;
        
    result = Object.keys(data).every( 
      key => job_list[i].hasOwnProperty(key) 
          && job_list[i][key] === data[key]); 

    if (result)
      break;
  }
  
  return result
}

//Add job to queue and update queue table
function addJob(data) {

  job_list.push(data);
  let index = job_list.indexOf(data);

  //Add entry to queue table
  let entry = formatQueueTableEntry(data);
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
    }
    else  
      td.innerText = entry[i];

    tr.appendChild(td);
  }

  //Add delete button
  let td = document.createElement("td");
  let a = document.createElement("a");
  a.className = "queue-delete";
  a.setAttribute("href", "#");
  a.setAttribute("uk-icon", "icon: trash");  
  a.addEventListener("click", removeFromQueue);

  td.appendChild(a);
  tr.appendChild(td);
  tbody.appendChild(tr);

  //utils.notify user
  utils.notify("Added Job For " + entry[0]);
};

function removeFromQueue(e) {
  let tr = this.closest("tr");
  let index = tr.attributes.jobIndex.value;
  delete job_list[index];
  tr.remove();
}

//Cancel button
document.getElementById("cancel").addEventListener("click", () => {
  cancel = true;

  if (builder.getChildProcess() != undefined)
    builder.cancelBuild();
});

//Export button
document.querySelector('button#export').addEventListener('click', e => {
  
  //Simple validation
  if (job_list.length == 0) {
    utils.notify("No jobs in queue");
    return false;
  }
  
  //Reset cancel state
  cancel = false;
  
  //Close all open notifications
  UIkit.notification.closeAll()
  
  //Show spinner and cancel button
  let sections = document.querySelectorAll(".uk-section");
  sections[0].style.display = "none";
  sections[1].style.display = "block";
  
  processQueue()
  .then (() => {
    //Hide spinner and cancel button
    sections[0].style.display = "block";
    sections[1].style.display = "none";
    console.log("EXPORT FINISHED");
  });
});

function processQueue() {
  
  return new Promise(async function(resolve, reject) {
    let queue = document.querySelectorAll("#queue tr");
    let totalJobs = queue.length;
    let lastJobType = "";
    
    for (let i = 0; i < queue.length; i++) {

      //Respond to cancel button
      if (cancel) break;

      //Get job index from queue
      let id = queue[i].attributes.jobIndex.value;
      let job = job_list[id];

      //Set export status message
      setExportStatus((i+1), totalJobs, job["project-name"] + " | " + job["project-type"].charAt(0).toUpperCase());
    
      //Update project XML
      project_xml.ProjectSettings.Name[0].$.value = document.querySelector("input#project-name").value;
      project_xml.ProjectSettings.Version[0].$.value = document.querySelector("input#project-version").value;
      
      //Disable VST3 on Linux (for now)
      if (process.platform == "linux") {
        project_xml.ProjectSettings.VST3Support = project_xml.ProjectSettings.VST3Support || [{"$":{value:0}}];
        project_xml.ProjectSettings.VST3Support[0].$.value = 0;
      }

      //Create packaging directory
      builder.createPackagingDirectory(job["project-path"]);

      //if job is not to create an installer
      if (job["project-type"] == "installer") {
        await buildInstaller(job);
      }
      else {
        await utils.writeXml(job["project-path"], project_xml);
        await doExport(job, (i+1), totalJobs);
      }

      //Remove job from queue
      if (!cancel) {
        queue[i].remove();
        delete job_list[id];
      }
    };
    resolve();
  }).catch((err) => {console.log('Caught! ' + err)});
}

async function buildInstaller(data) {
  
  switch (process.platform) {
    case "linux":
      await builder.buildInstallerGNU(data["project-path"], data["project-name"], data["project-version"]);
    break;
    
    case "darwin":
    break;
    
    case "win32":
    break;      
  }
}

async function doExport(data, current, total) {
  
  let args = getBuildArguments(data);
  
  setExportStatus(current, total, "Prepping Build");
  
  if (cancel == false) {
    await builder.setHISEFolder(data["hise-exec"], data["hise-path"]);
    await builder.setProjectFolder(data["hise-exec"], data["project-path"]);
    await builder.setProjectVersion(data["hise-exec"], data["project-version"]);    
  }
  
  if (cancel == false)
    await builder.cleanBuildDirectory(data["hise-exec"], data["project-path"]);
  
  setExportStatus(current, total, "Exporting HISE project");
  
  if (cancel == false)
    await builder.runHISEExport(data["hise-exec"], data["project-path"], data["project-file"], args);

  if (cancel == false)
    await builder.resaveJucerFile(data["hise-path"], data["project-path"]);
    
  setExportStatus(current, total, "Running Build");
 
  if (cancel == false) {
    let config;
    data["debug"] == undefined ? config = "Release" : config = "Debug";
    await builder.buildGNU(data["project-path"], config);
  }    
    
  setExportStatus(current, total, "Moving binary to packaging folder");
 
  if (cancel == false)
    await moveBinaryToPackaging(data["project-path"], data["project-name"], args);
}

function moveBinaryToPackaging(project_path, project_name, args) {
  
  return new Promise(function(resolve, reject) {
    
    //Get binary's file extension
    let ext = builder.getBinaryExtensionFromBuildArguments(args);
    
    //Get binary location
    let dir;
    switch (process.platform) {
      case "linux":
        dir = "/Binaries/Builds/LinuxMakefile/build/"
        break;
      case "darwin":
        break;
      case "win32":
        break;
    }

    //Generate a new name for the binary based on the build arguments
    let file_name = builder.assembleFileNameFromBuildArguments(project_path, project_name, args);
    
    //Set origin and destination for move file operation
    let origin = path.join(project_path, dir, project_name) + ext;
    let destination = path.join(project_path, "Packaging", process.platform, file_name) + ext;
        
    fs.rename(origin, destination, (err) => {
      if (err) throw err;
      console.log('Move complete!');
      resolve();
    });
    
  }).catch((err) => {console.log('Caught! ' + err)});
}

function getBuildArguments(data) {
  
  //Build arguments
  let args = [];

  if (data["ipp"]) args.push("-ipp");
  if (data["legacy"]) args.push("-l");
  if (data["plugin-format"]) args.push("-p:" + data["plugin-format"]);
  if (data["arch"]) args.push("-a:" + data["arch"]);
  if (data["project-type"]) args.push("-t:" + data["project-type"]);

  return args;  
}

function setExportStatus(current, total, message) {
  document.getElementById("export-status-message").innerText = "Exporting: " + current + "/" + total + " | " + message;
}

function hideControlsOnPlatform() {
  
  switch (process.platform) {
    case "linux":
      document.getElementById("vst3-label").style.display = "none";
      document.getElementById("au-label").style.display = "none";
      document.getElementById("aax-label").style.display = "none";
      document.getElementById("rlottie-label").style.display = "none";
      document.getElementById("apple-settings-field").style.display = "none";
    break;
    
    case "darwin":
    break;
    
    case "win32":
      document.getElementById("apple-settings-field").style.display = "none";
    break;
  }
}