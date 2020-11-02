const {ipcRenderer} = require('electron');
const utils = require('./utils.js');
const path = require('path');
const fs = require('fs');
const keytar = require('keytar')

//Browse HISE standalone button
document.querySelector('button#hise-exec-browse').addEventListener('click', e => {

  let default_dir = localStorage.getItem("hise-exec") || "";

  utils.openDir(default_dir, (response) => {
    let path = response.filePaths[0];

    if (path.indexOf("HISE") == -1) {
      alert("Not HISE Standalone Executable.");
      return false;
    }

    document.querySelector("input#hise-exec").value = path;

    return true;
  });
});

//Browse HISE path button
document.querySelector('button#hise-path-browse').addEventListener('click', e => {

  let default_dir = localStorage.getItem("hise-source") || "";

  utils.openDir(default_dir, (response) => {
    let dir = response.filePaths[0];
    let xmlPath = dir + "/hi_core/hi_core.cpp"; //Path to hi_core.cpp to validate path is correct

    if (!fs.existsSync(xmlPath)){
      alert("Not the HISE source folder");
      return false;
    }

    document.querySelector("input#hise-path").value = dir;

    return true;
  });
});

//Restore saved preferences
window.addEventListener('load', () => {
  let localStorage = window.localStorage;
  document.querySelector("input#hise-exec").value = localStorage.getItem("hise-exec");
  document.querySelector("input#hise-path").value = localStorage.getItem("hise-path");  
    
  //Apple ID (Mac only)
  if (process.platform == "darwin") {    
    document.querySelector("input#apple-id").value = localStorage.getItem("apple-id");
    
    //Restore apple password from keyring
    keytar.getPassword("hise-exporter", "apple-developer").then( p => {
      document.querySelector("input#apple-password").value = p;
    });
  }    
});

//Save button
document.querySelector("button#save-settings").addEventListener("click", e => {

  let hise = document.querySelector("input#hise-exec").value;
  let hise_path = document.querySelector("input#hise-path").value;
  let apple_id = document.querySelector("input#apple-id").value;
  let apple_password = document.querySelector("input#apple-password").value;

  
  if (process.platform == "darwin") {

    //Add extra bit of path for HISE exec on OSX if .app was selected
    if (path.extname(hise) == ".app")
      hise = path.join(hise, "Contents", "MacOS", "HISE");
  
    //Save Apple developer credentials in keyring
    if (apple_password.length > 4)
      keytar.setPassword("hise-exporter", "apple-developer", apple_password);
  }

  //Save non-secure settings in local storate
  let localStorage = window.localStorage;

  localStorage.setItem("hise-exec", hise);
  localStorage.setItem("hise-path", hise_path);
  localStorage.setItem("apple-id", apple_id);
  
  utils.notify("Settings Saved");
});
