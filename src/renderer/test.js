const utils = require('./utils.js');
const builder = require("./hise-builder.js");
const whitebox = require('./whitebox-generator.js');
const path = require('path');
const fs = require('fs');
const xml2js = require('xml2js');

const data = {
  "hise": {
    "linux":"/media/dave/Work\\ 1/HISE\\ Development\\ Builds/HISE/projects/standalone/Builds/LinuxMakefile/build/HISE\\ Standalone",
    "darwin":"/Volumes/HISE/HISE/projects/standalone/Builds/MacOSX/build/Release/HISE.app/Contents/MacOS/HISE"
  },
  "hise_source": {
    "linux":"/media/dave/Work\\ 1/HISE\\ Development\\ Builds/HISE",
    "darwin":"/Volumes/HISE/HISE"
  },
  "project_path":{
    "linux":"/media/dave/Work 1/Projects/Strings/michaelas_harp/HISE",
    "darwin":"/Users/laboratoryaudio/Desktop/harp"
  },
  "project_name":"Michaelas Harp",
  "project_file":"michaelasHarp.xml",
  "project_version":"1.0.0",
  "args":["-p:VST", "-l", "-ipp", "-a:x64", "-t:instrument"],
  "config":"Debug"
}

function buildInstallerGNU() {
  builder.buildInstallerGNU(project_path, project_name, project_version);
}

async function build() {
  await builder.setHISEFolder(data.hise[process.platform], data.hise_source[process.platform]);
  await builder.setProjectFolder(data.hise[process.platform], data.project_path[process.platform]);
  await builder.setProjectVersion(data.hise[process.platform], data.project_version);
  await builder.cleanBuildDirectory(data.hise[process.platform], data.project_path[process.platform]);
  await builder.runHISEExport(data.hise[process.platform], '"' + data.project_path[process.platform] + '"', data.project_file, data.args);
  await builder.resaveJucerFile(data.hise_source[process.platform], data.project_path[process.platform]);
  
  if (process.platform == "linux")
    await builder.buildGNU(data.project_path[process.platform], data.config);
  else
    await builder.buildOSX(data.project_path[process.platform], data.config);
    
  console.log("DONE");
}

function assembleFileName() {
  let fileName = builder.assembleFileNameFromBuildArguments(data.project_path.osx, data.project_name, data.args);
  return fileName;
}

function moveFile() {
  file_name = assembleFileName();
  let origin = '"' + project_path + "/Binaries/Builds/LinuxMakefile/build/" + project_name + '.so"';
  let destination = '"' + project_path + "/Packaging/" + process.platform + "/" + file_name + '"';
  utils.moveFile(origin, destination);
}

async function readXml() {
  let xml = await utils.readXml(project_path)
  console.log(project_xml);
}

async function writeXml() {
  let xml = await utils.readXml(project_path) //Read in some XML data to start

  //Create test value
  let test = Math.floor((Math.random() * 100) + 1); //Add random value to XML
  xml.ProjectSettings.test = [{"$":{value:test}}];

  //Update the xml
  await utils.writeXml(project_path, xml);
  
  //Read xml again and check test value
  xml = await utils.readXml(project_path);
  console.log(xml.ProjectSettings.test[0].$.value, test);
}

async function moveBinaryToPackaging() {

  let ext = builder.getBinaryExtension(data.args);
  let oldName = builder.getOutputName(data.project_name, data.config);
  let newName = builder.getNewFilename(data.project_path[process.platform], data.project_name, data.args, data.config);
  
  let oldPath = path.join(data.project_path[process.platform], builder.getOutputDirectory(data.config));
  let newPath = path.join(data.project_path[process.platform], "Packaging", process.platform);
  
  let origin = path.join(oldPath, oldName) + ext;
  let destination = path.join(newPath, newName) + ext;
   
  await utils.moveFile(origin, destination);
  console.log("File Moved");
}

function getOutputName() {
  console.log(builder.getOutputName(data.project_name, data.config));
}

function getOutputDirectory() {
  console.log(builder.getOutputDirectory(data.config));
}

function getBinaryExtension() {
  console.log(builder.getBinaryExtension(data.args));
}

function getNewFilename() {
  console.log(builder.getNewFilename(data.project_path[process.platform], data.project_name, data.args, data.config));
}

//Run tests
//readXml();
//writeXml();

//build();
//buildInstallerGNU();
//getOutputDirectory();
//getOutputName();
//getBinaryExtension();
//getNewFilename();
//moveBinaryToPackaging();

whitebox.readTemplate();
