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

const log = require('electron-log');
const path = require('path');

console.log = log.log;

let child; //Holds child_process object

exports.killChild = function() {
  try {
    process.kill(-child.pid);
  } catch (err) {
    console.log("Process is not active: ", err);
  }
};

exports.getChildProcess = function() {
  return child;
};

function asyncExec(cmd, args, opts) {
  const ex = require('child_process').exec;
  cmd = cmd + " " + args.join(" "); //Append arguments to cmd

  return new Promise(function(resolve, reject) {
    ex(cmd, opts || {}, (error, stdout, stderr) => {
      if (error) reject(error);
      resolve(stdout ? stdout : stderr);
    });
  }).catch((err) => {
    console.log('AsyncExec ' + err, cmd);
  });
}

function spawnChild(cmd, args, opts) {
  const {
    spawn
  } = require('child_process');
  opts.detached = true;
  let c = spawn(cmd, args, opts);
  c.stdout.on('data', (data) => {
    console.log(`stdout: ${data}`);
  });
  c.stderr.on('data', data => {
    console.log(`stderr: ${data}`);
  });
  return c;
}

exports.validateTeamId = function(team_id) {

  return new Promise(async function(resolve, reject) {
    let cmd = "security";
    let args = ["find-certificate", "-a", "-c", '"' + team_id + '"'];
    let result = await asyncExec(cmd, args);

    let app_id = result.includes("Developer ID Application");
    let installer_id = result.includes("Developer ID Installer");
    let format = team_id.includes("(") && team_id.includes(")");

    if (!format) resolve("format");
    if (!app_id) resolve("app");
    if (!installer_id) resolve("installer");
    resolve(true);
  }).catch((err) => {
    console.log(err);
  });
};

exports.signBinary = function(team_id, file) {
  console.log("Signing Binary");
  return asyncExec("codesign", ["--deep", "--force", "--options", "runtime", "--sign", '"Developer ID Application: ' + team_id + '"', '"' + file + '"', "--timestamp"]);
};

exports.signInstaller = function(team_id, in_file, out_file) {
  console.log("Signing Installer");
  return asyncExec("productsign", ["--sign", '"Developer ID Installer: ' + team_id + '"', '"' + in_file + '"', '"' + out_file + '"', "--timestamp"]);
};

exports.verifySignature = function(file) {
  return asyncExec("codesign", ["--verify", "--verbose", '"' + file + '"']);
};

exports.notarizeInstaller = function(pkg, bundle_id, apple_id, app_specific_password) {

  console.log("Notarizing Installer");

  return new Promise(async function(resolve, reject) {
    let result = await asyncExec("xcrun altool", ["--notarize-app", "-f", '"' + pkg + '"', "--primary-bundle-id", bundle_id, "-u", '"' + apple_id + '"', "-p", app_specific_password], {
      shell: true
    });

    console.log(result);

    if (result.includes("RequestUUID")) {
      let uuid = result.substring(result.indexOf("RequestUUID") + 14).trim();
      resolve(uuid);
    }
    let err = "Problem with notarization: " + result;
    reject(err);
  }).catch((err) => {
    console.log(err);
  });
};

function getNotarizationStatus(uuid, apple_id, app_specific_password) {
  return new Promise(async function(resolve, reject) {
    let result = await asyncExec("xcrun altool", ["--notarization-info", uuid, "-u", '"' + apple_id + '"', "-p", app_specific_password], {
      shell: true
    });
    if (result != undefined) {
      let status = result.substring(result.indexOf("Status") + 8, result.indexOf("LogFileURL")).trim();
      console.log("Notarization Status: ", result);
      resolve(status);
    } else
      resolve("No Result");
  }).catch((err) => {
    console.log(err);
  });
}
exports.getNotarizationStatus = getNotarizationStatus; //Export for testing

exports.stapleInstaller = function(pkg, uuid, apple_id, app_specific_password) {

  console.log("Stapling Installer");

  return new Promise(function(resolve, reject) {

    //Check notarization status every 30 seconds
    let timer = setInterval(async () => {
      let status = await getNotarizationStatus(uuid, apple_id, app_specific_password);

      if (status == "success") {
        let result = asyncExec("xcrun stapler staple", ['"' + pkg + '"'], {
          shell: true
        });
        resolve(result);
        clearInterval(timer);
      } else if (status == "invalid") {
        reject(status);
        clearInterval(timer);
      }
    }, 30 * 1000);

  }).catch((err) => {
    console.log(err);
  });
};

exports.validateStaple = function(pkg) {
  return asyncExec("xcrun stapler validate", ['"' + pkg + '"']);
};