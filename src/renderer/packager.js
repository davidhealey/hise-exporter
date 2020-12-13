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
const fs = require('fs-extra');
const path = require('path');
const xmlHandler = require("xml-js");
const os = require('os');

console.log = log.log;

//Get path to assets
const assetPath = process.env.NODE_ENV === 'development' ? path.join(__dirname, '../../assets')
  : path.join(process.resourcesPath, 'assets');

function copyResources(project_path, license, manual, readme, script) {
  let packagingDir = getPackagingDirectory(project_path);
  let resourcesDir = path.join(packagingDir, "Resources");
  let macScriptsDir = path.join(packagingDir, "Scripts");
    
  //Copy license
  if (license) {
    console.log("Copying license:", license);
    fs.copyFileSync(license, path.join(packagingDir, "License.txt"));
  }
  
  //Copy manual
  if (manual) {
    console.log("Copying Manual:", manual);
    fs.copyFileSync(manual, path.join(packagingDir, path.basename(manual)));
  }
  
  //Copy readme
  if (readme) {
    console.log("Copying readme:", readme);
    fs.copyFileSync(readme, path.join(packagingDir, "Read Me.txt"));
  }
  
  //Copy script
  if (script) {
    console.log("Copying Script:", script);
    if (process.platform == "darwin")
      fs.copyFileSync(script, path.join(macScriptsDir, "postinstall"));
    else if (process.platform == "linux")
      fs.copyFileSync(script, path.join(packagingDir, "gnu-setup-script.sh"));
  }  
}
 
exports.packageLinux = function(project_path, project_name, project_version, company_name, license_path, manual_path, script_path) {

  console.log("Packaging"); 

  return new Promise(async function(resolve, reject) {
    
    let makeself = path.join(assetPath, "makeself", "makeself.sh");
    let packagingDir = getPackagingDirectory(project_path);
    let fileName = project_name + " " + project_version + ".run";

    //Copy resources to packaging folder
    copyResources(project_path, license_path, manual_path, "", script_path);

    //Copy user manual to packaging folder
		if (manual_path && path.extname(manual_path) == ".pdf")
			fs.copyFileSync(manual_path, path.join(packagingDir, project_name + " User Manual.pdf"));

    //If no script provided then use default template
    if (!script)
      await editGnuInstallerScriptTemplate(project_path, project_name, company_name);

    //Run makeself
    console.log("Running makeself");
    await utils.asyncExecFile(
      '"' + makeself + '"',
      [
        "--license " + '"' + license_path + '"',
        '"' + packagingDir + '"',
        '"' + fileName + '"',
        '"' + project_name + '"',
        "./gnu-setup-script.sh"
      ],
      {shell:true, cwd:packagingDir}
    );

    //Cleanup
    if (manual_path) fs.removeSync(path.join(packagingDir, path.basename(manual_path)));
    fs.removeSync(path.join(packagingDir, "License.txt"));
    fs.removeSync(path.join(packagingDir, "gnu-setup-script.sh"));

    resolve(path.join(packagingDir, fileName));
  }).catch((err) => {console.log(err);});
};

function removeOldGNUScripts(project_path, project_name) {

  console.log("Removing old installer");
  
  return new Promise(function(resolve, reject) {
    let packagingDir = getPackagingDirectory(project_path);  
    //Go through all the files in the packaging directory and remove any .sh ones
    fs.readdir(packagingDir, (err, files) => {
      if (err) throw (err);

      files.every(file => {
        if (path.extname(file) == ".sh" || path.extname(file) == ".run") {
          console.log(file);
          fs.removeSync(path.join(packagingDir, file));
        }
        return true;
      });
      resolve();
    });
  }).catch((err) => {console.log(err);});
}

function editGnuInstallerScriptTemplate(project_path, project_name, company_name) {

  console.log("Setting up GNU installer template");
  
  return new Promise(function(resolve, reject) {
    let packagingDir = getPackagingDirectory(project_path);
    let templatePath = path.join(assetPath, "gnu-setup-script.sh");
    let template = fs.readFileSync(templatePath, "utf8"); //Normal build
    let legacy = 0;

    //Go through all the files in the packaging directory and check for legacy builds
    fs.readdir(packagingDir, (err, files) => {
      if (err) throw (err);
      
      files.every(file => {
        console.log(file);
        if (file.includes("(L)")) {
          legacy = 1;
          return false;
        }
        return true;
      });

      template = template.replaceAll("%STANDALONE_NAME%", project_name);
      template = template.replaceAll("%PROJECT_NAME%", project_name);
      template = template.replaceAll("%COMPANY_NAME%", company_name);
      template = template.replace("%LEGACY%", legacy);
      
      fs.writeFileSync(path.join(packagingDir, "gnu-setup-script.sh"), template);
      resolve();
      
    });
  }).catch((err) => {console.log(err);});
}

exports.packageDarwin = function(project_path, project_name, project_version, company_name, license_path, manual_path, readme_path, script_path) {

  console.log("Packaging");

  return new Promise(async function(resolve, reject) {
    let packagingDir = getPackagingDirectory(project_path);
    let packagesProj = path.join(packagingDir, "packages-template.pkgproj");
    let whiteboxPackages = path.join("/usr", "local", "bin", "packagesbuild");
    let outputPath = path.join(packagingDir, project_name + " unsigned.pkg");
    
    //Copy files to packaging/resources/scripts directories
    copyResources(project_path, license_path, manual_path, readme_path);

    await configurePackagesTemplate(project_path, project_name, project_version, company_name);

    console.log("Running Whitebox Packages.");
    await utils.asyncExec('"' + whiteboxPackages + '"', [packagesProj], {"shell":true});
        
    //Cleanup
    fs.removeSync(packagesProj);
    fs.removeSync(path.join(packagingDir, "License.txt"));
    fs.removeSync(path.join(packagingDir, "Read Me.txt"));
    if (manual_path) fs.removeSync(path.join(packagingDir, path.basename(manual_path)));

    resolve(outputPath);
  }).catch((err) => {console.log(err);});
};

exports.packageWin32 = function(project_path, project_name, project_version, company_name, license_path, manual_path) {
	
  console.log("Packaging");
  
  return new Promise(async function(resolve, reject) {
		
		let packagingDir = getPackagingDirectory(project_path);
		
    //Copy resources to packaging folder
    copyResources(project_path, license_path, manual_path);
    			
		//Configure InnoSetup template
		let result = await editInnoTemplate(project_path, project_name, project_version, company_name);
		
		//Run InnoSetup
		await runInnoSetup(project_path, result.normal, result.legacy);
		
		//Cleanup
		fs.removeSync(path.join(packagingDir, "License.txt"));
		if (manual_path) fs.removeSync(path.join(packagingDir, path.basename(manual_path)));
		fs.removeSync(path.join(packagingDir, "rlottie_x86.dll"));
		fs.removeSync(path.join(packagingDir, "rlottie_x64.dll"));		
	
		resolve();
	}).catch((err) => {console.log(err);});
};

function configurePackagesTemplate(project_path, project_name, project_version, company_name) {

  console.log("Configuring Package Template.");
  
  return new Promise(async function(resolve, reject) {  
    let packagingDir = getPackagingDirectory(project_path);
    let templatePath = path.join(assetPath, "packages-template.pkgproj");
    let template = fs.readFileSync(templatePath, "utf8"); //Normal build
    
    //Get all file names in packaging directory
    let files = await fs.readdir(packagingDir);

    let extensions = [".app", ".component", ".vst", ".vst3", ".aaxplugin", ".pdf", ".txt"];
    
    for (let file of files) {
      if (extensions.includes(path.extname(file))) {
      
        console.log("Adding File: ", file);

        let token;
      
        switch(path.extname(file)) {
          case ".app": token = "%STANDALONE_APPLICATION%"; break;
          case ".component": token = "%AU_PLUGIN%"; break;
          case ".vst": token = "%VST_PLUGIN%"; break;
          case ".vst3": token = "%VST3_PLUGIN%"; break;
          case ".aaxplugin": token = "%AAX_PLUGIN%"; break;
          case ".pdf":
            token = "%USER_GUIDE%";
            template = template.replace("%USER_GUIDE_FILE%", file);
          break;
          case ".txt":
            if (file == "Read Me.txt")
              token = "%README%"
          break;
        }
        
        //Remove token-ed comments from template
        template = template.replaceAll("<?" + token, "");
        template = template.replaceAll(token + "?>", "");
      }
    }
    
    //Replace generic tokens in template
    template = template.replaceAll("%PROJECT_NAME%", project_name);
    template = template.replaceAll("%PROJECT_NAME_NO_SPACES%", project_name.replaceAll(" ", ""));
    template = template.replaceAll("%COMPANY_NAME%", company_name);
    template = template.replaceAll("%COMPANY_NAME_NO_SPACES%", company_name.replaceAll(" ", "-").toLowerCase());
    template = template.replaceAll("%VERSION%", project_version);
    
    console.log("Writing template to packaging folder.");
    fs.writeFileSync(path.join(packagingDir, "packages-template.pkgproj"), template);  
    resolve();
  }).catch((err) => {console.log(err);});
}

function makeMacComponents(project_path, project_name, project_version, company_name) {
  
  console.log("Building component packages");
  
  return new Promise(async function(resolve, reject) {
  
    let packagingDir = getPackagingDirectory(project_path);
  
    //Get all file names in packaging directory
    let files = await fs.readdir(packagingDir);

    //Process each file in sequence
    let extensions = [".app", ".component", ".vst", ".vst3", ".aaxplugin"];
    for (const file of files) {

      if (extensions.includes(path.extname(file))) {
            
        let pkgId = getPkgIdentifier(company_name, project_name, file); //Bundle id
        let installLocation = getMacInstallLocation(company_name, file);

        console.log("Packaging:", file);

        await utils.asyncExec(
          "pkgbuild",
          [
            "--install-location",
            '"' + installLocation + '"',
            "--version",
            project_version,
            "--identifier",
            pkgId,
            "--component",
            '"' + packagingDir + '/' + file + '"',
            '"' + packagingDir + '/' + file + '.pkg"'
          ],
          {shell:true}
        );
      }
    }
    resolve();
  }).catch((err) => {console.log(err);});
}

function makeMacDistributionPlist(dir) {

  console.log("Making distribution plist");
  
  return new Promise(async function(resolve, reject) {
    
    let args = ["--synthesize"];
        
    //Get all file names in packaging directory
    let files = await fs.readdir(dir);

    //Add all component packages as build arguments
    for (const file of files) {
      if (path.extname(file) == ".pkg") {
        console.log("Adding package to plist:", file);
        args.push("--package");
        args.push('"' + file + '"');
      }
    }
        
    //Add output path to arguments
    let outputPath = path.join(dir, "distribution.plist");
    args.push('"' + outputPath + '"');
      
    //Run productbuild to build distribution plist.
    await utils.asyncExec("productbuild", args, {shell:true, cwd:dir});
  
    resolve(outputPath);
  }).catch((err) => {console.log(err);});
}

function editMacDistributionPlist(plist_path, license_path, readme_path) {

  console.log("Configuring distribution plist")

  return new Promise(async function(resolve, reject) {
          
    //Read in plist xml and convert to object
    let xml = fs.readFileSync(plist_path, "utf8");    
    let xmlObj = xmlHandler.xml2js(xml);

    //Add license
    if (fs.existsSync(license_path)) {
      let license = {type:"element", name:"license", attributes:{file:license_path}};
      xmlObj.elements[0].elements.push(license);
    }

    //Add readme
    if (fs.existsSync(readme_path)) {
      let readme = {type:"element", name:"readme", attributes:{file:readme_path}};
      xmlObj.elements[0].elements.push(readme);    
    }

    //Edit elements
    for (let element of xmlObj.elements[0].elements) {
      
      if (element.name == "options") {
       element.attributes.customize = "always";
      }

      //Set title property for choices and make visible
      if (element.name == "choice") {
        if (element.attributes.id == "default") {
          element.attributes.title = "All";
          element.attributes.description = "This will install everything.";
        }
        else {
          let title = getMacPackageTitle(element.attributes.id);
          let description = getMacPackageDescription(element.attributes.id);
          console.log("Adding title and description:", title, ":", description);
          element.attributes.title = title;
          element.attributes.description = description;
          element.attributes.visible = "true";
        }
      }
    }

    //Convert object back to xml and write
    xml = xmlHandler.js2xml(xmlObj, {spaces:4});

    fs.writeFile(plist_path, xml,  () => resolve());

  }).catch((err) => {console.log(err);});
}

function buildMacPackage(plist_path, output_path, packaging_dir, resources_dir, scripts_dir) {

  console.log("Building distribution package");
  
  return new Promise(async function(resolve, reject) {
            
    let args = [
      "--distribution",
      '"' + plist_path + '"',
      "--resources",
      '"' + resources_dir + '"',
      "--scripts",
      '"' + scripts_dir + '"'
      ];

    //Set output path    
    args.push('"' + output_path + '"');

    //Run productbuild to build distribution plist.
    await utils.asyncExec("productbuild", args, {shell:true, cwd:packaging_dir});
 
    resolve(output_path);
  });
}

function getMacPackageTitle(id) {
  let title = path.extname(id).replace(".", "");
  title = title.replace(/([A-Z])/g, ' $1').trim(); //Add spaces to between uppercase
  title = title.replace("V S T", "VST");
  title.replace("V S T 3", "VST3");
  title.replace("A U", "AU");
  title.replace("A A X", "AAX");
  
  return title;
}

function getMacPackageDescription(id) {

  let description = "This will install the ";
  
  if (id.includes("Standalone"))
    description += "Standalone app.";
    
  if (id.includes("VST") && !id.includes("VST3"))
    description += "VST2 plugin.";

  if (id.includes("VST3"))
    description += "VST3 plugin.";
  
  if (id.includes("AU"))
    description += "AU plugin.";
    
  if (id.includes("AAX"))
    description += "AAX plugin, for use in Pro-Tools.";

  if (id.includes("Documentation"))
    description += "User manual.";
    
  return description;
}

//Generates Apple bundle ID for given file_name
function getPkgIdentifier(company_name, project_name, file_name) {

  let id = "com." + company_name.toLowerCase() + ".pkg." + project_name;

  switch(path.extname(file_name)) {
    case ".pdf": id = id + "Documentation"; break;
    case ".app": id = id + "Standalone"; break;
    case ".vst": id = id + "VST"; break;
    case ".vst3": id = id + "VST3"; break;
    case ".component": id = id + "AU"; break;
    case ".axxplugin": id = id + "AAX"; break;
  }

  if (file_name.includes("(L)")) id = id + "Legacy";
  if (file_name.includes("IPP")) id = id + "Ipp";
  if (file_name.includes("Debug")) id = id + "Debug";
  
  id = id.replaceAll(" ", "");
  
  console.log("Getting package ID for", file_name, id);

  return id;
}

//Determines install location for mac binary
function getMacInstallLocation(company_name, file_name) {
  
  let result = "/Library/Audio/Plug-Ins";
  
  switch(path.extname(file_name)) {
    case ".pdf": result = path.join("Applications", company_name, "Documentation"); break;
    case ".app": result = path.join("Applications", company_name); break;
    case ".vst": result = result + "/VST"; break;
    case ".vst3": result = result + "/VST3"; break;
    case ".component": result = result + "/Components"; break;
    case ".aaxplugin": result = "/Library/Application Support/Avid/Plug-Ins"; break;    
  }
  console.log("Getting installation location for", file_name, result);
  return result;
}

function copyInnoSetupTemplate(project_path) {
	return new Promise(async function(resolve, reject) {
		let template = path.join(assetPath, "inno-template.iss");
		let destination = getPackagingDirectory(project_path);
		await fs.copy(template, path.join(destination, "inno.iss"));
		resolve();
	}).catch((err) => {console.log(err);});
}
exports.copyInnoSetupTemplate = copyInnoSetupTemplate;

function copyRlottieLibraries(project_path) {
	return new Promise(async function(resolve, reject) {
		let x32 = path.join(assetPath, "rlottie", "rlottie_x86.dll");
		let x64 = path.join(assetPath, "rlottie", "rlottie_x64.dll");
		let destination = getPackagingDirectory(project_path);
		await fs.copy(x32, path.join(destination, "rlottie_x86.dll"));
		await fs.copy(x64, path.join(destination, "rlottie_x64.dll"));
		resolve();
	}).catch((err) => {console.log(err);});
}
exports.copyRlottieLibraries = copyRlottieLibraries;

function editInnoTemplate(project_path, project_name, project_version, company_name, legacy) {
	console.log("Setting up InnoSetup template");
  
	return new Promise(function(resolve, reject) {    
    let packaging = getPackagingDirectory(project_path);
		let templatePath = path.join(assetPath, "inno-template.iss");
		let template = fs.readFileSync(templatePath, "utf8"); //Normal build
		let lTemplate = fs.readFileSync(templatePath, "utf8"); //Legacy build
		let normal = false; //Indicates if non-legacy installer to be built
		let legacy = false; //Indicates if legacy installer to be built
	
		//Go through all the files in the packaging directory
		fs.readdir(packaging, (err, files) => {
			if (err) throw (err);
			files.forEach(file => {
			
				if (file.includes("rlottie")) {
					lTemplate = lTemplate.replaceAll(";%RLOTTIE%", "");
					template = template.replaceAll(";%RLOTTIE%", "");
				}
				else if (file.includes(project_name)) {
					
					if (file.includes("User Manual")) {
						lTemplate = lTemplate.replaceAll(";%USER_MANUAL%", "");
						template = template.replaceAll(";%USER_MANUAL%", "");
					}
					else {
					
						//Assemble token to remove from templates
						let token = ";%";

						switch (path.extname(file)) {
							case ".exe": token += "APP";	break;
							case ".dll": token += "VST2"; break;
							case ".vst3":	token += "VST3";	break;
							case ".aaxplugin": token += "AAX";	break;
						}

						file.includes("x86") ? token += "_32" : token += "_64";// jshint ignore:line

						if (file.includes("L")) {
							legacy = true;
							lTemplate = lTemplate.replaceAll(token + "_LEGACY%", "");
						}
						else {
							normal = true;
							template = template.replaceAll(token + "%", "");						
						}
					}
				}
			});

			if (normal) {
				console.log("Writing inno setup file");
				template = template.replace("%APP_NAME%", project_name);
				template = template.replace("%APP_VERSION%", project_version);
				template = template.replace("%DEFAULT_DIRECTORY%", company_name + "\\" + project_name);
				template = template.replace("%OUTPUT_NAME_EXTRA%", "");
				fs.writeFileSync(path.join(packaging, "installer.iss"), template);
			}
			
			if (legacy) {
				lTemplate = lTemplate.replace("%APP_NAME%", project_name);
				lTemplate = lTemplate.replace("%APP_VERSION%", project_version);
				lTemplate = lTemplate.replace("%DEFAULT_DIRECTORY%", company_name + "\\" + project_name);
				lTemplate = lTemplate.replace("%OUTPUT_NAME_EXTRA%", " Legacy CPU");
				fs.writeFileSync(path.join(packaging, "legacy-installer.iss"), lTemplate);
			}

			resolve({"normal":normal, "legacy":legacy});
		});
	}).catch((err) => {console.log(err);});
}
exports.editInnoTemplate = editInnoTemplate;

function runInnoSetup(project_path, normal, legacy) {
	return new Promise(async function(resolve, reject) {
		let packaging = getPackagingDirectory(project_path);
		let file = path.join(packaging, "installer.iss");
		let legacyFile = path.join(packaging, "legacy-installer.iss");
		let username = os.userInfo().username; //Windows username		
		let inno = path.join("C:", "Users", username, "AppData", "Local", "Programs", "Inno Setup 6", "ISCC.exe");

		if (normal) {
			console.log("Building installer");
			let result = await utils.asyncExec('"' + inno + '"', ['"' + file + '"'], {"shell":true});
			console.log(result);
		}
		
		if (legacy) {
			console.log("Building legacy CPU installer");
			let result = await utils.asyncExec('"' + inno + '"', ['"' + legacyFile + '"'], {"shell":true});
			console.log(result);
		}

		//Cleanup
		fs.removeSync(file);
		fs.removeSync(legacyFile);
		
		resolve();
	}).catch((err) => {console.log(err);});
}

//Creates directory to store compiled binaries
exports.createPackagingDirectory = function(project_path) {  
  return new Promise(function(resolve, reject) {
    let dir = path.join(project_path, "Packaging", process.platform);
    
    fs.mkdir(dir, { recursive: true }, (err) => {
      if (err) throw(err);
      resolve();
    });
  }).catch((err) => {
    console.log(err);
    reject();
  });
};

const getPackagingDirectory = function(project_path) {
  return path.join(project_path, "Packaging", process.platform);
};

exports.getPackagingDirectory = getPackagingDirectory;