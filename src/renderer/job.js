/*  
Copyright 2020, 2021 David Healey
This file is part of Hise-Exporter.
  
Hise-Exporter is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

Hise-Exporter is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with Waistline.  If not, see <http://www.gnu.org/licenses/>.
*/

const utils = require('./utils.js');
const settings = require('./settings.js');
const queue = require('./queue.js');
const log = require('electron-log');

console.log = log.log;

//Job type select
document.querySelector('select#project-type').addEventListener('change', async function(e) {

  let value = e.target.value;

  //Reset the form to clear it, but then set the value of the select back to the selection 
  document.getElementById("job-form").reset();
  document.querySelector('select#project-type').value = value;

  //Hide all job elements
  document.getElementById("plugin-formats-field").style.display = "none";
  document.getElementById("plugin-categories-field").style.display = "none";
  document.getElementById("architecture-field").style.display = "none";
  document.getElementById("features-field").style.display = "none";
  document.getElementById("osx-features-field").style.display = "none";
  document.getElementById("notarize-label").style.visibility = "hidden";
  document.getElementById("license-field").style.display = "none";
  document.getElementById("readme-field").style.display = "none";
  document.getElementById("manual-field").style.display = "none";
  document.getElementById("post-install-script-field").style.display = "none";
  document.getElementById("add-job-field").style.display = "none";

  //Show elements for plugins
  if (value == "instrument" || value == "effect")
    document.getElementById("plugin-formats-field").style.display = "block";

  //Show elements for installer or standalone + plugins
  if (value == "installer") {
    document.getElementById("license-field").style.display = "block";
    document.getElementById("manual-field").style.display = "block";

    //Show installer script box on Linux (add Darwin support later)
    if (process.platform != "win32" && process.platform != "darwin")
      document.getElementById("post-install-script-field").style.display = "block";
  } else if (value != "") { //Standalone and plugins

    if (process.platform != "darwin")
      document.getElementById("features-field").style.display = "block";

    //Linux and Darwin will always be 64bit
    if (process.platform != "win32") {
      document.getElementById("architecture-field").style.display = "none";
      document.getElementById("x64").checked = true;
    } else
      document.getElementById("architecture-field").style.display = "block";
  }

  //Apple specific options
  if (process.platform == "darwin") {

    //Check for valid Apple credentials
    let credentials = await settings.getAppleCredentials();
    let appleId = credentials["apple-id"] != undefined && credentials["apple-id"] != "";
    let teamId = credentials["apple-team-id"] != undefined && credentials["apple-team-id"] != "";
    let appPass = credentials["app-specific-password"] != undefined && credentials["app-specific-password"] != "";

    if (value != "" && appleId)
      document.getElementById("osx-features-field").style.display = "block";

    if (value == "installer") {

      if (teamId && appPass)
        document.getElementById("notarize-label").style.visibility = "visible";

      document.getElementById("readme-field").style.display = "block";
    }
  }

  if (value != "")
    document.getElementById("add-job-field").style.display = "block";
});

//Plugin format radio buttons 
document.getElementsByName('plugin-format').forEach(function(e) {
  e.addEventListener("click", function() {

    if (e.value != "AU") {
      setPluginCategories(e.value);
      document.getElementById("plugin-categories-field").style.display = "block";
    } else
      document.getElementById("plugin-categories-field").style.display = "none";
  });
});

//Add to queue button 
document.querySelector("button#add-to-queue").addEventListener("click", async (e) => {
  let data = await parseForms();

  if (typeof data == "object")
    queue.addJob(data);
});

//If Notarization is enabled, force codesigning too
document.querySelector('input#notarize').addEventListener('change', e => {
  if (e.target.checked) {
    let codesignCheckbox = document.querySelector("input#codesign");
    codesignCheckbox.checked = true;
  }
});

document.querySelector('input#codesign').addEventListener('change', e => {
  let notarizeCheckbox = document.querySelector("input#notarize");
  if (notarizeCheckbox.checked) {
    e.target.checked = true;
    utils.notify("Must be enabled for notarization.");
  }
});

function parseForms() {

  return new Promise(async function(resolve, reject) {
    result = {};

    //Get all form data 
    let form = document.getElementById("project-form").elements;
    for (let element of form) {
      result[element.id] = element.value;
    }

    //Job form
    form = document.getElementById("job-form").elements;
    for (let element of form) {
      if (element.type == "checkbox") {
        if (element.checked) {
          if (element.name == "plugin-categories") {
            result[element.name] = result[element.name] || [];
            result[element.name].push(element.value);
          } else
            result[element.id] = true;
        }
      } else if (element.type == "radio") {
        if (element.checked) {
          result[element.name] = element.value;
        }
      } else
        result[element.id] = element.value;
    }

    //Settings form
    form = document.getElementById("settings-form").elements;
    for (let element of form) {
      result[element.id] = element.value;
    }

    //Simple validation
    let notice = await verifyFormData(result);

    if (notice !== true) {
      utils.notify(notice);
      reject(notice);
    }

    resolve(result);
  }).catch((err) => {
    console.log(err);
  });
}

function verifyFormData(data) {

  return new Promise(async function(resolve, reject) {

    if (data["project-type"] != "installer" && !utils.checkHISEPath())
      resolve("HISE source path not correct.");

    if (data["project-type"] != "installer" && !utils.checkHISEExec())
      resolve("HISE executable path not correct.");

    if (process.platform == "darwin" && data["project-type"] == "installer" && !utils.checkWhiteboxPackages())
      resolve("Whitebox Packages not found");

    if (process.platform == "win32" && data["project-type"] == "installer" && !utils.checkVisualStudio())
      resolve("Visual studio not found.");

    if (data["project-path"] == "")
      resolve("No project selected");

    if (data["project-type"] != "installer" && data["project-file"] == "")
      resolve("No project XML file selected");

    if ((data["project-type"] == "instrument" || data["project-type"] == "effect") && !data["plugin-format"])
      resolve("Plugin format was not specified.");

    if (data["project-type"] != "installer" && !data["arch"])
      resolve("Architecture was not specified.");

    if (data["project-type"] != "installer" && process.platform == "win32" && !utils.checkASIOSDK())
      resolve("ASIO SDK not found.");

    if (data["project-type"] == "installer" && !data["license-path"])
      resolve("License file missing.");

    if (data["project-type"] == "installer" && !utils.checkCompanyName())
      resolve("Company name has not been set.");

    if (data["project-type"] == "installer" && process.platform == "win32" && !utils.checkInnoSetup())
      resolve("Inno Setup 6 (64bit) installation not found.");

    if (data["plugin-format"] == "VST2" && !utils.checkVST2SDK())
      resolve("VST2 SDK not found.");

    if (data["plugin-format"] == "VST3" && !utils.checkVST3SDK())
      resolve("VST3 SDK not found.");

    if (data["plugin-format"] == "AAX" && !utils.checkAAXSDK())
      resolve("AAX SDK not found.");

    //Verify Apple credentials are present if required
    if (process.platform == "darwin" && (data["codesign"] || data["notarize"])) {
      let credentials = await settings.getAppleCredentials();

      if (credentials["apple-id"] == "" || credentials["apple-id"] == undefined)
        resolve("Apple ID has not set.");

      if (credentials["apple-team-id"] == "" || credentials["apple-team-id"] == undefined)
        resolve("Apple Team ID has not been set.");

      if (credentials["app-specific-password"] == "" || credentials["app-specific-password"] == undefined)
        resolve("Apple app specific password has not been set");
    }

    resolve(true);
  }).catch((err) => {
    console.log(err);
  });
}

function setPluginCategories(format) {

  //Get categories and prefix
  let categories;
  let prefix = "";

  switch (format) {

    case "VST2":
      prefix = "kPlugCateg";
      categories = ["Unknown", "Effect", "Synth", "Analysis", "Mastering", "Spacializer", "RoomFx", "SurroundFx", "Restoration", "OfflineProcess", "Shell", "Generator"];
      break;

    case "VST3":
      categories = ["Fx", "Instrument", "Analyzer", "Delay", "Distortion", "Drum", "Dynamics", "EQ", "External", "Filter", "Generator", "Mastering", "Modulation", "Mono", "Network", "NoOfflineProcess", "OnlyOfflineProcess", "OnlyRT", "Pitch Shift", "Restoration", "Reverb", "Sampler", "Spatial", "Stereo", "Surround", "Synth", "Tools", "Up-Downmix"];
      break;

    case "AU":
      break;

    case "AAX":
      prefix = "AAX_ePlugInCategory_";
      categories = ["None", "EQ", "Dynamics", "PitchShift", "Reverb", "Delay", "Modulation", "Harmonic", "NoiseReduction", "Dither", "SoundField", "HWGenerators", "SWGenerators", "WrapperPlugin", "Effect"];
      break;
  }

  //Add categories to form
  let ul = document.getElementById("plugin-categories");
  ul.innerHTML = "";

  let defaults = ["Instrument", "Synth", "SWGenerators"];

  for (let c of categories) {

    let li = document.createElement("li");

    let input = document.createElement("input");

    if (format == "VST2") { //VST2 can only have one category
      input.type = "radio";
      input.className = "uk-radio";
    } else {
      input.type = "checkbox";
      input.className = "uk-checkbox";
    }

    input.name = "plugin-categories";
    input.id = c;
    input.value = prefix + c;

    if (defaults.includes(c))
      input.checked = "checked";

    li.appendChild(input);

    let t = document.createTextNode("  " + c.replace(/(?!^)([A-Z]|\d+)/g, " $1"));
    li.appendChild(t);

    ul.appendChild(li);
  }
}