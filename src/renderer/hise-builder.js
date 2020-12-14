/*  
Copyright 2018 David Healey
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
const path = require('path');
const fs = require('fs-extra');
const os = require('os');

console.log = log.log;
console.error = log.error;

let child; //Holds child_process object when running build

exports.killChild = function() {
  try {
		console.log("Killing child process.");
    process.kill(-child.pid);
  }
  catch (err) {
    console.log("Process is not active: ", err);
  }
};

exports.getChildProcess = function() {
  return child;
};

exports.build = function(project_path, arch) {
  
  return new Promise(function(resolve, reject) {
    let cmd = "";
    let args = [];
    let cwd = path.join(project_path, "Binaries", "Builds");
		let config = "Release";
    let threads = os.cpus().length * 2 - 1;

    switch (process.platform) {
      case "linux":
        cmd = "make";
        args = ["CONFIG=" + config, "AR=gcc-ar", "-j", threads];
        cwd = path.join(cwd, "LinuxMakefile");
      break;
        
      case "darwin":
        cmd = "xcodebuild";
        args = ["-project", "*.xcodeproj", "-configuration", config, "-jobs", threads];
        cwd = path.join(cwd, "MacOSX");
      break;
      
      case "win32":
				if (arch == "x86") arch = "Win32";
				cmd = '"C:/Program Files (x86)/Microsoft Visual Studio/2017/Community/MSBuild/15.0/Bin/MsBuild.exe"';
				args = ["-ignore:.vcxproj", "-nr:false", "/p:Configuration=" + config, "/p:Platform=" + arch, "-maxcpucount:" + threads, "-fl", "-flp:logfile=BuildOutput.log;verbosity=minimal"];
				cwd = path.join(cwd, "VisualStudio2017");
      break;
    }    
  
    child = utils.spawnChild(cmd, args, {shell: true, "cwd": cwd});
    child.on('close', code => {code == 0 ? resolve() : reject(code);});
    child.stdout.on('data', (data) => {console.log(`stdout: ${data}`);});
    child.stderr.on('data', data => {console.log(`stderr: ${data}`);});
  }).catch((err) => {throw new Error(err);});
};

//Assembles a new filename for the binary - without extension
exports.getNewFilename = function(current_filename, ipp, legacy) {
	let extra = "";
	if (ipp != undefined && process.platform == "Linux") extra += " (IPP)";
  if (legacy != undefined) extra += " (L)";	
	
	return current_filename + extra;
};

//Determines the extension of the binary file
exports.getBinaryExtension = function(project_type, plugin_format) {
  
  let ext = "";
  if (plugin_format == "VST3") ext = ".vst3";
  if (plugin_format == "AU") ext = ".component";
  if (plugin_format == "AAX") ext = ".aaxplugin";
  
  if (ext == "") {
    switch (process.platform) {
      case "linux":
        if (project_type.toLowerCase() == "standalone") ext = ".run";
        if (plugin_format == "VST2") ext = ".so";
      break;
      
      case "darwin":
        if (project_type.toLowerCase() == "standalone") ext = ".app";
        if (plugin_format == "VST2") ext = ".vst";
      break;
      
      case "win32":
        if (project_type.toLowerCase() == "standalone") ext = ".exe";
        if (plugin_format == "VST2") ext = ".dll";
      break;
    }
  }  
  return ext;
};

//Get location of binary file output by build process
exports.getOutputDirectory = function(project_path, project_type, plugin_format) {

  let dir = path.join(project_path, "Binaries");
  
  switch (process.platform) {
    case "linux":
      return path.join(dir, "Builds", "LinuxMakefile", "build");
    
		case "darwin":
      if (project_type == "standalone")
        return path.join(dir, "Compiled");
      else
        return path.join(dir, "Builds", "MacOSX", "build", "Release");
    break;
		
    case "win32":
			if (project_type == "standalone")
				return path.join(dir, "Compiled", "App");
			else if (plugin_format == "VST2")
				return path.join(dir, "Compiled", "VST");
			else
				return path.join(dir, "Compiled", plugin_format);
		break;			
  }
};

//Get name of generated binary file - without extension
exports.getOutputName = function(project_name, arch) {
  
	if (process.platform == "win32")
		return project_name + " " + arch;
	else
		return project_name;
};

/*
* Wrappers for HISE CLI commands
*/
exports.setHISEFolder = function(hise, hise_source) {
	console.log("Setting HISE source folder.");
	if (process.platform != "win32") hise_source = '"' + hise_source + '"';
  return utils.asyncExec('"' + hise + '"', ["set_hise_folder", "-p:" + hise_source]);
};

exports.setProjectFolder = function(hise, project_path) {
	console.log("Setting Project folder.");
	if (process.platform != "win32") project_path = '"' + project_path + '"';
  return utils.asyncExec('"' + hise + '"', ["set_project_folder", "-p:" + project_path]);
};

exports.setProjectVersion = function(hise, project_version) {
	console.log("Setting Project version.");
  return utils.asyncExec('"' + hise + '"', ["set_version", "-v:" + project_version]);
};

exports.cleanBuildDirectory = function(hise, project_path) {
	console.log("Cleaning build directory.");
  return utils.asyncExec('"' + hise + '"', ["clean", "-p:" + project_path, "--all"]);
};

exports.runHISEExport = function(hise, project_path, project_file, build_data) {
  return new Promise(function(resolve, reject) {
		console.log("Running HISE Export.");
		let project;

		if (path.extname(project_file) == ".xml")
			project = path.join(project_path, "XmlPresetBackups", project_file);
		else
			project = path.join(project_path, "Presets", project_file);

		args = getBuildArguments(build_data);
		child = utils.spawnChild('"' + hise + '"', ["export_ci", '"' + project + '"', args], {shell: true});
		child.on('close', code => {code == 0 ? resolve() : reject(code);});
    child.stdout.on('data', (data) => {console.log(`stdout: ${data}`);});
    child.stderr.on('data', (data) => {console.error(`stderr: ${data}`);});
	}).catch((err) => {reject(new Error(err));});
};

//Assemble args into string for HISE export via CLI
function getBuildArguments(data) {

	let result = "";
	
	if (data["project-type"]) result += "-t:" + data["project-type"] + " ";
	
	if (data["plugin-format"]) {
		if (data["plugin-format"].includes("VST"))
			result += "-p:VST ";
		else
			result += "-p:" + data["plugin-format"] + " ";
	}
	
	if (data["arch"])
		result += "-a:" + data["arch"] + " ";
	
	if (data["ipp"])
		result += "-ipp ";
		
	if (data["legacy-cpu"])
		result += "-l ";

	console.log(result);
	
	return result.trim();
}

//Resaves the AutogeneratedProject.jucer file
exports.resaveJucerFile = function(hise_source, project_path) {
  
	return new Promise(async function(resolve, reject) {
		console.log("Resaving jucer file.");
		let projucer = path.join(hise_source, "tools", "projucer", "Projucer"); 
		let cwd = path.join(project_path, "Binaries");
		
		//Append extension on Windows
		if (process.platform == "win32")
			projucer += ".exe";

		//Append additional file path on MacOS
		if (process.platform == "darwin")
			projucer = path.join(projucer + ".app", "Contents", "MacOS", "Projucer");

		//Add executable permissions to Projucer binary
		fs.chmodSync(projucer, 0o775);
				
		child = utils.spawnChild('"' + projucer + '"', ["--resave AutogeneratedProject.jucer"], {shell: true, "cwd": cwd});
		child.on('close', code => {code == 0 ? resolve() : reject(code);});
	}).catch((err) => {console.log(err);});
};