const uuidv4 = require('uuid');
const path = require('path');
const fs = require('fs');
const xmlParser = require('xml-js');
const xml2js = require('xml2js');

const assetPath = process.env.NODE_ENV === 'development'
    ? path.join(__dirname, '../../assets')
    : path.join(process.resourcesPath, 'assets');

const templates = {
   "standalone-vst-au": path.join(assetPath, "package-templates", "standalone-vst-au.pkgproj")
 };

let template; //To hold template XML JSON object

exports.getTemplate = function(template_name) {
  return new Promise(function(resolve, reject) {

    try {
      let file = fs.readFile(templates[template_name], 'utf8', (err, data) => {
        if (err) throw(err);
        console.log(data);
        resolve(data);
      });
    } catch (e) {
      reject(e);
    }
  });  
}




/*function readXml(xml_path) {

  return new Promise(function(resolve, reject) {

    try {
      let file = fs.readFile(xml_path, 'utf8', (err, data) => {
        if (err) throw(err);
        let result = xmlParser.xml2js(data, {compact: false});
        resolve(result);
      });
    } catch (e) {
      reject(e);
    }
  });
}

exports.readTemplate = async function() {

  readXml(template_path)
  .then((result) => {
    template = result;
    //console.log(template);
  });
}

exports.constructPackage = function() {
  readXml(path.join(assetPath, "raw-package-template.xml"))
  .then((xmlObj) => {
    console.log(xmlObj);
  }); 
}*/

