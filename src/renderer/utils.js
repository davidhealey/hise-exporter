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

const {
  ipcRenderer
} = require('electron');
const log = require('electron-log');
const UIkit = require('uikit');
const path = require('path');
const xmlHandler = require("xml-js");
const fs = require('fs-extra');
const os = require('os');

console.log = log.log;

exports.readXml = function(xml_path) {
  console.log("Read XML: ", xml_path);
  let xml = fs.readFileSync(xml_path, "utf8");
  return xmlHandler.xml2js(xml);
};

//Convert object back to xml and write
exports.writeXml = function(xml_path, xml_obj) {
  console.log("Write XML: ", xml_path);
  let xml = xmlHandler.js2xml(xml_obj, {
    spaces: 4
  });

  if (xml != undefined && xml != "") {
    fs.unlinkSync(xml_path); //Delete old file
    fs.writeFileSync(xml_path, xml); //Write new file
  }
};

exports.openDir = function(default_dir, callback) {
  ipcRenderer.invoke('openDir', {
      default: default_dir
    })
    .then(response => {
      if (response.canceled) return false;
      callback(response);
    });
};

exports.openFile = function(default_dir, filters, callback) {
  ipcRenderer.invoke('openFile', {
      default: default_dir,
      "filters": filters
    })
    .then(response => {
      if (response.canceled) return false;
      callback(response);
    });
};

exports.moveFile = function(origin, destination) {

  return new Promise(function(resolve, reject) {
    fs.rename(origin, destination, (err) => {
      if (err) throw err;
      reject();
      resolve();
    });
  }).catch(err => {
    throw (err);
  });
};

exports.copyFile = function(origin, destination) {
  return fs.copyFile(origin, destination);
};

let spawnChild = function(cmd, args, opts) {
  const {
    spawn
  } = require('child_process');
  opts.detached = true;
  return spawn(cmd, args, opts);
};
exports.spawnChild = spawnChild;

const asyncExec = function(cmd, args, opts) {
  const ex = require('child_process').exec;
  cmd = cmd + " " + args.join(" "); //Append arguments to cmd

  return new Promise(function(resolve, reject) {
    ex(cmd, opts || {}, (error, stdout, stderr) => {
      if (error) reject(error);
      resolve(stdout ? stdout : stderr);
    });
  }).catch((err) => {
    console.log(err, cmd);
  });
};
exports.asyncExec = asyncExec;

const asyncExecFile = function(file, args, opts) {
  const ex = require('child_process').execFile;

  return new Promise(function(resolve, reject) {
    ex(file, args, opts || {}, (error, stdout, stderr) => {
      if (error) reject(error);
      resolve(stdout ? stdout : stderr);
    });
  }).catch((err) => {
    console.log(err, file);
  });
};
exports.asyncExecFile = asyncExecFile;

exports.notify = function(message) {
  UIkit.notification({
    message: message,
    status: 'primary',
    pos: 'top-right',
    timeout: 3000
  });
};

exports.validateEmail = function(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

exports.setExportStatus = function(task, num1, num2, project_name, status) {
  if (status != undefined && status != "") status = " | " + status;
  message = task + ": " + num1 + "/" + num2 + " " + project_name + " " + status;
  console.log(message);
  document.getElementById("export-status-message").innerText = message;
};

exports.checkHISEPath = function() {
  let dir = window.localStorage.getItem("hise-path");
  return fs.existsSync(dir);
};

exports.checkHISEExec = function() {
  let file = window.localStorage.getItem("hise-exec");
  return fs.existsSync(file);
};

exports.checkVisualStudio = function() {
  let dir = "C:/Program Files (x86)/Microsoft Visual Studio";
  return fs.existsSync(dir);
};

exports.checkInnoSetup = function() {
  let username = os.userInfo().username; //Windows username
  let file = path.join("C:", "Users", username, "AppData", "Local", "Programs", "Inno Setup 6", "ISCC.exe");
  return fs.existsSync(file);
};

exports.checkASIOSDK = function() {
  let hise = window.localStorage.getItem("hise-path");
  let dir = path.join(hise, "tools", "SDK", "ASIOSDK2.3", "common");
  return fs.existsSync(dir);
};

exports.checkAAXSDK = function() {
  let hise = window.localStorage.getItem("hise-path");
  let dir = path.join(hise, "tools", "SDK", "AAX", "Libs");
  return fs.existsSync(dir);
};

exports.checkWhiteboxPackages = function() {
  let file = path.join("/usr", "local", "bin", "packagesbuild");
  return fs.existsSync(file);
};

exports.checkVST2SDK = function() {
  let hise = window.localStorage.getItem("hise-path");
  let file = path.join(hise, "tools", "SDK", "VST3 SDK", "pluginterfaces", "vst2.x", "aeffect.h");
  return fs.existsSync(file);
};

exports.checkVST3SDK = function() {
  let hise = window.localStorage.getItem("hise-path");
  let dir = path.join(hise, "JUCE", "modules", "juce_audio_processors", "format_types", "VST3_SDK");
  return fs.existsSync(dir);
};

exports.checkCompanyName = function() {
  let t = window.localStorage.getItem("company-name");
  return t != "" && t != undefined;
};

exports.checkIpp = function() {

  let paths = {
    "linux": path.join("opt", "intel", "ipp"),
    "darwin": path.join("opt", "intel", "ipp"),
    "win32": false
  };

  if (paths[process.platform])
    return fs.existsSync(paths.process.platform);
};