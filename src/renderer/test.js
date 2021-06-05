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
const queue = require('./queue.js');
const prj = require('./index.js');
const codesign = require('./codesign.js');
const builder = require("./hise-builder.js");
const packager = require('./packager.js');
const path = require('path');
const fs = require('fs-extra');
const xmlHandler = require("xml-js");
const keytar = require('keytar');

const data = {
  "hise": {
    "linux": "/media/dave/Work 1/HISE Development Builds/HISE/projects/standalone/Builds/LinuxMakefile/build/HISE Standalone",
    "darwin": "/Volumes/HISE/HISE/projects/standalone/Builds/MacOSX/build/Release/HISE.app/Contents/MacOS/HISE",
    "win32": "Z:/HISE/projects/standalone/Builds/VisualStudio2017/x64/Release/App/HISE.exe"
  },
  "hise_source": {
    "linux": "/media/dave/Work 1/HISE Development Builds/HISE",
    "darwin": "/Volumes/HISE/HISE",
    "win32": "Z:/HISE"
  },
  "project_path": {
    //"linux":"/media/dave/Work 1/Projects/Strings/michaelas_harp/HISE",
    "linux": "/home/dave/Downloads/sordina-1.0.0",
    "darwin": "/Users/laboratoryaudio/Desktop/harp",
    "win32": "Y:/Strings/michaelas_harp/HISE"
  },
  "binary": {
    "darwin": "/Users/laboratoryaudio/Desktop/harp/Packaging/darwin/test.vst"
  },
  "license": {
    "linux": "/media/dave/Work 1/Projects/Strings/michaelas_harp/HISE/License.txt",
    "win32": "Y:/Strings/michaelas_harp/HISE/License.txt",
    "darwin": "/Volumes/Projects/Strings/michaelas_harp/HISE/License.txt"
  },
  "user_manual": {
    "win32": "Y:/Strings/michaelas_harp/HISE/user manual.pdf",
    "darwin": "/Volumes/Projects/Strings/michaelas_harp/HISE/user manual.pdf"
  },
  "project_name": "Michaelas Harp",
  "project_file": "michaelasHarp.xml",
  "project_version": "1.0.0",
  "company_name": "Libre Wave",
  "job": {
    "project-type": "instrument",
    "plugin-format": "VST2",
    "arch": "x86"
  }
  //"job":{"project-type":"standalone", "arch":"x64"}
};

async function build() {

  await builder.setHISEFolder(data.hise[process.platform], data.hise_source[process.platform]);
  await builder.setProjectFolder(data.hise[process.platform], data.project_path[process.platform]);
  await builder.setProjectVersion(data.hise[process.platform], data.project_version);
  await builder.cleanBuildDirectory(data.hise[process.platform], data.project_path[process.platform]);
  await builder.runHISEExport(data.hise[process.platform], data.project_path[process.platform], data.project_file, data.job);

  await builder.resaveJucerFile(data.hise_source[process.platform], data.project_path[process.platform]);
  await builder.build(data.project_path[process.platform], data.job.arch);

  console.log("DONE");
}

function assembleFileName() {
  let fileName = builder.assembleFileNameFromBuildArguments(data.project_path.osx, data.project_name, data.args);
  return fileName;
}

async function copyBinaryToPackaging() {

  let ext = builder.getBinaryExtension(data.job["project-type"], data.job["plugin-format"]);
  let oldName = builder.getOutputName(data.project_name, data.job.arch);
  //let newName = builder.getNewFilename(data.project_path[process.platform], data.project_name, data.project_version, data.job["arch"], data.job["ipp"], data.job["legacy-cpu"]);
  let newName = builder.getNewFilename(oldName, data.job["ipp"], data.job["legacy-cpu"]);

  let oldPath = builder.getOutputDirectory(data.project_path[process.platform], data.job["project-type"], data.job["plugin-format"]);
  let newPath = packager.getPackagingDirectory(data.project_path[process.platform]);

  let origin = path.join(oldPath, oldName) + ext;
  let destination = path.join(newPath, newName) + ext;

  await fs.copy(origin, destination);
  console.log("File Copied");
}

function getOutputName() {
  console.log(builder.getOutputName(data.project_name, data.job["arch"]));
}

function getOutputDirectory() {
  console.log(builder.getOutputDirectory(data.project_path[process.platform], data.job["project-type"], data.job["plugin-format"]));
}

function getBinaryExtension() {
  console.log(builder.getBinaryExtension(data.job["project-type"], data.job["plugin-format"]));
}

function getNewFilename() {
  console.log(builder.getNewFilename(data.project_path[process.platform], data.project_name, data.project_version, data.job["ipp"], data.job["legacy-cpu"]));
}

async function codesignBinary() {
  let team_id = localStorage.getItem("apple-team-id");
  let file = data.binary.darwin;
  await codesign.signBinary(team_id, file);
  console.log("Codesign Binary Complete");
}

async function codesignInstaller() {
  let team_id = localStorage.getItem("apple-team-id");
  let file = "/Users/laboratoryaudio/Desktop/harp/Packaging/darwin/Michaelas Harp 1.0.0 unsigned.pkg";
  let outputFile = file.replace("unsigned", "signed");
  await codesign.signInstaller(team_id, file, outputFile);
  fs.removeSync(file); //Delete unsigned version
  console.log("Codesign Installer Complete");
}

function verifySignature() {
  let file = "/Users/laboratoryaudio/Desktop/harp/Packaging/darwin/test.rtf";
  codesign.verifySignature(file)
    .then((out) => {
      console.log(out);
    });
}

function notarize() {
  return new Promise(async function(resolve, reject) {
    let pkg = "/Users/laboratoryaudio/Desktop/harp/Packaging/darwin/Michaelas Harp 1.0.0 signed.pkg";
    let apple_id = localStorage.getItem("apple-id");
    let bundle_id = "com.company.vst.plugin";
    let app_specific_password = await keytar.getPassword("hise-exporter", "app-specific-password");

    let uuid = await codesign.notarizeInstaller(pkg, bundle_id, apple_id, app_specific_password);

    console.log(uuid.replace("RequestUUID = ", ""));

    resolve(uuid.replace("RequestUUID = ", ""));
  }).catch((err) => {
    console.log('Caught! ' + err);
  });
}

async function getNotarizationStatus() {
  let uuid = "734db1eb-eeeb-44a1-9807-9e3973970c4b"; //Get from notarization
  let apple_id = localStorage.getItem("apple-id");
  let app_specific_password = await keytar.getPassword("hise-exporter", "app-specific-password");

  let status = await codesign.getNotarizationStatus(uuid, apple_id, app_specific_password);

  console.log(status);
}

async function staple() {
  let pkg = "/Users/laboratoryaudio/Desktop/harp/Packaging/darwin/Michaelas Harp 1.0.0 signed.pkg";
  let uuid = "734db1eb-eeeb-44a1-9807-9e3973970c4b"; //Get from notarization
  let app_specific_password = await keytar.getPassword("hise-exporter", "app-specific-password");
  let apple_id = localStorage.getItem("apple-id");

  let result = await codesign.stapleInstaller(pkg, uuid, apple_id, app_specific_password);
  console.log(result);
}

async function package() {

  let outputFile;

  switch (process.platform) {
    case "linux":
      outputFile = await packager.packageLinux(data.project_path.linux, data.project_name, data.project_version, data.company_name, data.license.linux);
      break;
    case "darwin":
      outputFile = await packager.packageDarwin(data.project_path.darwin, data.project_name, data.project_version, data.company_name, data.license.darwin, data.user_manual.darwin);
      break;
    case "win32":
      outputFile = await packager.packageWin32(data.project_path.win32, data.project_name, data.project_version, data.company_name, data.license.win32, data.user_manual.win32);
      break;
  }
  console.log("Packaging Test Complete: ", outputFile);
}

function createPackagingDirectory() {
  packager.createPackagingDirectory(data.project_path[process.platform]);
}

async function getAppSpecificPassword() {
  let pass = await keytar.getPassword("hise-exporter", "app-specific-password");
  console.log(pass);
}

function timerTest() {
  let count = 0;
  let timer = setInterval(function() {
    console.log(count);
    if (count > 9) {
      clearInterval(timer);
      console.log("Timer Complete");
    }
    count++;
  }, 500);
}

function extractUUIDFromNotarizationResult() {
  let result = "2020-11-15 17:37:41.223 altool[1331:34597] No errors uploading '/Users/laboratoryaudio/Desktop/harp/Packaging/darwin/Michaelas Harp 1.0.0 signed.pkg'. RequestUUID = 215f7a7e-be83-4264-928c-eec532f1b1f8";
  let uuid = result.substring(result.indexOf("RequestUUID") + 14).trim();
  console.log(uuid);
  return uuid;
}

async function validateTeamId() {
  let result = await codesign.validateTeamId("XTANT");
  console.log(result);
}

function configureInnoTemplate() {
  packager.configureInnoTemplate(data.project_path[process.platform], data.project_name, data.project_version, data.company_name);
}

function copyRlottieLibraries() {
  packager.copyRlottieLibraries(data.hise_source[process.platform], data.project_path[process.platform]);
}

function updateProjectInfoXml() {

  let xmlData = {};
  xmlData["Name"] = data.project_name;
  xmlData["Version"] = data.project_version;
  xmlData["VST3Support"] = Math.floor(Math.random() * 2);

  queue.updateProjectInfoXml(data.project_path[process.platform], xmlData);
}

function watchLogFile() {

  let filePath = path.join("$HOME", "Library", "Logs", "hise-exporter", "renderer.log");

  /* fs.watch(filePath, (event, filename) => {
     if (filename) {
       if (fsWait) return;
       fsWait = setTimeout(() => {
         fsWait = false;
       }, 100);
       const md5Current = md5(fs.readFileSync(buttonPressesLogFile));
       if (md5Current === md5Previous) {
         return;
       }
       md5Previous = md5Current;
       console.log(`${filename} file Changed`);
     }
   });*/
}

//Run tests
//updateProjectInfoXml();
//timerTest();
//build();
//configureInnoTemplate();
//copyRlottieLibraries();
//createPackagingDirectory();
//getOutputDirectory();
//getOutputName();
//getBinaryExtension();
//getNewFilename();
//copyBinaryToPackaging();
//codesignBinary();
//package();
//codesignInstaller();
//notarize()
//extractUUIDFromNotarizationResult();
//getNotarizationStatus();
//staple();
//verifySignature();
//verifyNotarization();
//getAppSpecificPassword();
//validateTeamId();