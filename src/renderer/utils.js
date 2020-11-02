const { ipcRenderer } = require('electron');
const UIkit = require('uikit');
const path = require('path');
const xml2js = require('xml2js');
const fs = require('fs');

exports.readXml = function(xml_path) {
  
  return new Promise(function(resolve, reject) {
      
    try {
      let file = fs.readFile(xml_path, (err, data) => {
        if (err) throw(err);
        let parser = new xml2js.Parser();
        parser.parseStringPromise(data).then(result => resolve(result));
      });
    } catch (e) {
      reject(e);
    }
  });
}

exports.writeXml = function(path, data) {

  return new Promise(function(resolve, reject) {
    
    try {
      let xmlBuilder = new xml2js.Builder({xmldec: {'version': '1.0','encoding': 'UTF-8'}});
      let xml = xmlBuilder.buildObject(data);

      fs.writeFile(path + "/project_info.xml", xml, () => resolve());

    } catch (e) {
        reject(e);
    }
  });
}

exports.openDir = function(default_dir, callback) {
  ipcRenderer.invoke('openDir', {
    default: default_dir
  }).then(response => {
    if (response.canceled) return false;
    callback(response);
  });
}

exports.moveFile = function(origin, destination) {

  /*if (process.platform == "win32")
    return asyncExec("move", ["-f", '"' + origin + '"', '"' + destination + '"']);
  else
    return asyncExec("mv", ["-f", '"' + origin + '"', '"' + destination + '"']);*/
  return new Promise(function(resolve, reject) {
    fs.rename(origin, destination, (err) => {
      if (err) throw err;
      resolve();
    }); 
  });    
}

let spawnChild = function(cmd, args, opts) {
  const { spawn } = require('child_process');
  opts.detached = true;
  opts.stdio = "inherit";
  return spawn(cmd, args, opts);
}

const asyncExec = function(cmd, args, opts) {
  const ex = require('child_process').exec;
  cmd = cmd + " " + args.join(" "); //Append arguments to cmd

  return new Promise(function(resolve, reject) {
    ex(cmd, opts || {}, (error, stdout, stderr) => {
      if (error) reject(error);
      resolve(stdout ? stdout : stderr);
    });
  }).catch((err) => {console.log('Caught! ' + err, cmd)});
}

const asyncExecFile = function(file, args, opts) {
  const ex = require('child_process').execFile;

  return new Promise(function(resolve, reject) {
    ex(file, args, opts || {}, (error, stdout, stderr) => {
      if (error) reject(error);
      resolve(stdout ? stdout : stderr);
    });
  }).catch((err) => {console.log('Caught! ' + err, file)});
}

exports.notify = function(message) {
  UIkit.notification({
    message: message,
    status: 'primary',
    pos: 'top-right',
    timeout: 3000
  });
}

exports.asyncExec = asyncExec;
exports.asyncExecFile = asyncExecFile;
exports.spawnChild = spawnChild;