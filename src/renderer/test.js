const utils = require('./utils.js');
const builder = require("./hise-builder.js");
const fs = require('fs');
const xml2js = require('xml2js');

const hise = "/media/dave/Work\\ 1/HISE\\ Development\\ Builds/HISE/projects/standalone/Builds/LinuxMakefile/build/HISE\\ Standalone";
const hise_source = "/media/dave/Work\\ 1/HISE\\ Development\\ Builds/HISE";
const project_path = "/media/dave/Work 1/Projects/Strings/michaelas_harp/HISE";
const project_name = "Michaelas Harp";
const project_file = "michaelasHarp.xml";
const project_version = "1.0.0";
const makeself_path = "/media/dave/Work\\ 1/Projects/tools/makeself";
const args = ["-l", "-p:VST", "-a:x86x64", "-t:instrument"];

function buildInstallerGNU() {
  builder.buildInstallerGNU(project_path, project_name, project_version, makeself_path);
}

async function buildGNUAllArgs() {
  await builder.setHISEFolder(hise, hise_source);
  await builder.setProjectFolder(hise, project_path);
  await builder.setProjectVersion(hise, project_version);
  await builder.cleanBuildDirectory(hise, project_path);
  await builder.runHISEExport(hise, '"' + project_path + '"', project_file, args);
  await builder.resaveJucerFile(hise_source, project_path);
  await builder.buildGNU(project_path, "Debug")
  console.log("DONE");
}

function assembleFileName() {
  fileName = builder.assembleFileName(project_path, project_name, args);
  return fileName;
}

function moveFile() {
  file_name = assembleFileName();
  let origin = '"' + project_path + "/Binaries/Builds/LinuxMakefile/build/" + project_name + '.so"';
  let destination = '"' + project_path + "/Packaging/" + process.platform + "/" + file_name + '"';
  builder.moveFile(origin, destination);
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

//Run tests
//buildInstallerGNU();
//readXml();
//writeXml();
//buildGNUAllArgs();
//assembleFileName();
//moveFile();