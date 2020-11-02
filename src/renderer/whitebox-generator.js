const uuidv4 = require('uuid');
const path = require('path');
const fs = require('fs');
const xmlParser = require('xml-js');

const assetPath = process.env.NODE_ENV === 'development'
    ? path.join(__dirname, '../../assets')
    : path.join(process.resourcesPath, 'assets');

const template_path = path.join(assetPath, "template.pkgproj")
let template; //To hold template XML JSON object

function readXml(xml_path) {

  return new Promise(function(resolve, reject) {
      
    try {
      let file = fs.readFile(xml_path, 'utf8', (err, data) => {
        if (err) throw(err);

        let result1 = xmlParser.xml2json(data, {compact: true, spaces: 4});
        let result2 = xmlParser.xml2js(data, {compact: false, spaces: 4});
        console.log(result2);
        
        resolve();
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