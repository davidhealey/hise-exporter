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
const log = require('electron-log');
const fs = require('fs-extra');
const path = require('path');

console.log = log.log;

let project_info; //From project_info.xml

hideControlsOnPlatform();

const getProjectInfo = function(key) {
  if (project_info == undefined) return false;
  for (let element of project_info.elements[0].elements) {
    if (element.name == key)
      return element.attributes.value;
  }
};
exports.getProjectInfo = getProjectInfo;

//Open directory browser and populate sibling text input with selected dir
//then trigger text input's callback.
let elements = document.querySelectorAll("button.open-dir");
for (let i = 0; i < elements.length; i++) {
  elements[i].addEventListener("click", e => {
    let textInput = e.target.previousElementSibling;

    //Open dir browser 
    let localStorage = window.localStorage;
    let lastDir = localStorage.getItem("last-dir") || "";

    utils.openDir(lastDir, (response) => {
      let dir = response.filePaths[0];
      textInput.value = dir;
      localStorage.setItem("last-dir", dir);

      //Trigger change event for textInput
      let evt = document.createEvent("HTMLEvents");
      evt.initEvent("change", false, true);
      textInput.dispatchEvent(evt);
    });
  });
}

//Open file browser and populate sibling text input with selected file
//then trigger text input's callback.
elements = document.querySelectorAll("button.open-file");
for (let i = 0; i < elements.length; i++) {
  elements[i].addEventListener("click", e => {
    let textInput = e.target.previousElementSibling;
    let filters = eval(e.target.getAttribute("filters"));

    //Open file browser
    let localStorage = window.localStorage;
    let lastDir = localStorage.getItem("last-dir") || "";

    utils.openFile(lastDir, filters, (response) => {
      let file = response.filePaths[0];
      textInput.value = file;

      //Trigger change event for textInput
      let evt = document.createEvent("HTMLEvents");
      evt.initEvent("change", false, true);
      textInput.dispatchEvent(evt);
    });
  });
}

document.getElementById("project-path").addEventListener("change", e => {

  let dir = e.target.value;

  //Verify selected dir is a HISE project
  let projectInfoPath = path.join(dir, "project_info.xml"); //Path to project xml

  if (!fs.existsSync(projectInfoPath)) {
    document.getElementById("project-path").value = "";
    utils.notify("Not a HISE project folder");
    return false;
  }

  project_info = utils.readXml(projectInfoPath);

  //Add project info to UI
  document.querySelector("input#project-name").value = getProjectInfo("Name");
  document.querySelector("input#project-version").value = getProjectInfo("Version");
  document.querySelector("input#plugin-code").value = getProjectInfo("PluginCode");

  //Reset project export settings form
  document.getElementById("job-form").reset();

  //Populate project file dropdown and make visible
  addProjectFilesToSelect(dir);
  document.getElementById("hidden-until-project").style.visibility = "visible";

  //Trigger event for project-type selection
  let evt = document.createEvent("HTMLEvents");
  evt.initEvent("change", false, true);
  document.getElementById('project-type').dispatchEvent(evt);
});

//Populate project file select drop down
async function addProjectFilesToSelect(project_folder) {

  document.getElementById("hidden-until-xml").style.visibility = "hidden";

  //Add projects to dropdown
  let select = document.querySelector("select#project-file");
  select.innerHTML = "";

  //.xml projects
  let xmlDir = path.join(project_folder, "XmlPresetBackups");
  if (fs.existsSync(xmlDir)) {
    let files = await fs.readdir(xmlDir);

    for (let file of files) {
      if (path.extname(file) == ".xml")
        addOption(file);
    }
  }

  //.hip projects
  let presetsDir = path.join(project_folder, "Presets");
  if (fs.existsSync(presetsDir)) {
    let files = await fs.readdir(presetsDir);

    for (let file of files) {
      if (path.extname(file) == ".hip")
        addOption(file);
    }
  }

  if (!select.length)
    utils.notify("There are no XML backups or .hip files in the selected project.");
  else
    document.getElementById("hidden-until-xml").style.visibility = "visible";

  function addOption(file) {
    let option = document.createElement("option");
    option.value = file;
    option.innerText = file;
    select.appendChild(option);
  }
}

function hideControlsOnPlatform() {

  switch (process.platform) {
    case "linux":
      document.getElementById("au-label").style.display = "none";
      document.getElementById("aax-label").style.display = "none";
      document.getElementById("apple-settings-field").style.display = "none";
      break;

    case "darwin":
      document.getElementById("legacy-label").style.display = "none";
      break;

    case "win32":
      document.getElementById("au-label").style.display = "none";
      document.getElementById("apple-settings-field").style.display = "none";
      break;
  }
}