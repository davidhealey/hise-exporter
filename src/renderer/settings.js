/*  
Copyright 2020, 2021, 2022 David Healey
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

const {
  ipcRenderer
} = require('electron');
const utils = require('./utils.js');
const codesign = require('./codesign.js');
const log = require('electron-log');
const path = require('path');
const fs = require('fs-extra');
const keytar = require('keytar');

console.log = log.log;

//Browse HISE standalone button
document.querySelector('button#hise-exec-browse').addEventListener('click', e => {

  let default_dir = localStorage.getItem("hise-exec") || "";

  utils.openFile(default_dir, [], (response) => {
    let file_path = response.filePaths[0];

    if (!file_path.includes("HISE")) {
      utils.notify("Not HISE Standalone Executable.");
      return false;
    }

    //Add extra bit of path for HISE exec on OSX if .app was selected
    if (process.platform == "darwin") {
      if (path.extname(file_path) == ".app")
        file_path = path.join(file_path, "Contents", "MacOS", "HISE");
    }

    document.querySelector("input#hise-exec").value = file_path;

    return true;
  });
});

//Browse HISE path button
document.querySelector('button#hise-path-browse').addEventListener('click', e => {

  let default_dir = localStorage.getItem("hise-source") || "";

  utils.openDir(default_dir, (response) => {
    let dir = response.filePaths[0];
    let xmlPath = dir + "/hi_core/hi_core.cpp"; //Path to hi_core.cpp to validate path is correct

    if (!fs.existsSync(xmlPath)) {
      utils.notify("Not the HISE source folder");
      return false;
    }

    document.querySelector("input#hise-path").value = dir;

    return true;
  });
});

//Restore saved preferences
window.addEventListener('load', () => {

  form = document.getElementById("settings-form").elements;
  for (let element of form) {
    if (window.localStorage.getItem(element.id) != undefined)
      element.value = window.localStorage.getItem(element.id);
  }

  //App-specific-password (MacOS)
  if (process.platform == "darwin") {
    keytar.getPassword("hise-exporter", "app-specific-password").then(p => {
      document.querySelector("input#app-specific-password").value = p;
    });
  }
});

//Save button
document.querySelector("button#save-settings").addEventListener("click", async function(e) {

  //Gather settings form data
  let data = {};
  form = document.getElementById("settings-form").elements;
  for (let element of form) {
    data[element.id] = element.value.trim();

    //Validate emails
    if (element.type == "email" && element.value != "") {
      let valid = utils.validateEmail(element.value);
      if (!valid) {
        utils.notify("Invalid email address.");
        return false;
      }
    }
  }

  if (process.platform == "darwin") {

    //Verify team ID has appropriate certificates in keychain
    if (data["apple-team-id"]) {
      let result = await codesign.validateTeamId(data["apple-team-id"]);

      if (result != true) {
        if (result == "format")
          utils.notify("Team ID format is not correct.");
        else if (result == "app")
          utils.notify("Application certificate not found for Team ID.");
        else
          utils.notify("Installation certificate not found for Team ID.");

        return false;
      }
      data["apple-team-id"] = data["apple-team-id"].toUpperCase();
    }

    //Save Apple developer credentials in keyring
    keytar.setPassword("hise-exporter", "app-specific-password", data["app-specific-password"]);
  }

  //Save non-secure settings in local storage
  let localStorage = window.localStorage;

  for (let k in data) {
    localStorage.setItem(k, data[k]);
  }

  utils.notify("Settings Saved");
});

exports.getAppleCredentials = async function() {
  let result = {};
  let localStorage = window.localStorage;

  result["apple-id"] = localStorage.getItem("apple-id");
  result["apple-team-id"] = localStorage.getItem("apple-team-id");
  result["app-specific-password"] = await keytar.getPassword("hise-exporter", "app-specific-password");
  return result;
};

exports.getLocalSetting = function(key) {
  let localStorage = window.localStorage;
  return localStorage.getItem(key);
};

exports.getAppSpecificPassword = function() {
  return keytar.getPassword("hise-exporter", "app-specific-password");
};