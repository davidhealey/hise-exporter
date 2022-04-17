[Setup]
#define AppName "%APP_NAME%"
#define AppVersion "%APP_VERSION%"
AppName={#AppName}
AppVersion={#AppVersion}

DefaultDirName={pf}\%DEFAULT_DIRECTORY%
DefaultGroupName={#AppName}
Compression=lzma2
SolidCompression=yes
OutputDir=.\
ArchitecturesInstallIn64BitMode=x64
OutputBaseFilename={#AppName}%OUTPUT_NAME_EXTRA% {#AppVersion}
LicenseFile=License.txt
PrivilegesRequired=admin

SetupLogging=yes
ChangesAssociations=no

[Types]
Name: "full"; Description: "Full installation"
Name: "custom"; Description: "Custom installation"; Flags: iscustom

[Dirs]
Name: "{app}\"; Permissions: users-modify powerusers-modify admins-modify system-modify

[Components]

; Standard
;%APP_32%Name: "app_32"; Description: "{#AppName} Standalone Application 32-bit"; Types: full custom;
;%APP_64%Name: "app_64"; Description: "{#AppName} Standalone Application 64-bit"; Types: full custom; Check: Is64BitInstallMode;

;%VST2_32%Name: "vst2_32"; Description: "{#AppName} VST2 Plugin 32-bit"; Types: full custom;
;%VST2_64%Name: "vst2_64"; Description: "{#AppName} VST2 Plugin 64-bit"; Types: full custom; Check: Is64BitInstallMode;

;%VST3_32%Name: "vst3_32"; Description: "{#AppName} VST3 Plugin 32-bit"; Types: full custom;
;%VST3_64%Name: "vst3_64"; Description: "{#AppName} VST3 Plugin 64-bit"; Types: full custom; Check: Is64BitInstallMode;

;%AAX%Name: "aax"; Description: "{#AppName} AAX Plugin"; Types: full custom;

; LEGACY
;%APP_32_LEGACY%Name: "app_32"; Description: "{#AppName} Standalone Application 32-bit"; Types: full custom;
;%APP_64_LEGACY%Name: "app_64"; Description: "{#AppName} Standalone Application 64-bit"; Types: full custom; Check: Is64BitInstallMode;

;%VST2_32_LEGACY%Name: "vst2_32"; Description: "{#AppName} VST2 Plugin 32-bit"; Types: full custom;
;%VST2_64_LEGACY%Name: "vst2_64"; Description: "{#AppName} VST2 Plugin 64-bit"; Types: full custom; Check: Is64BitInstallMode;

;%VST3_32_LEGACY%Name: "vst3_32"; Description: "{#AppName} VST3 Plugin 32-bit"; Types: full custom;
;%VST3_64_LEGACY%Name: "vst3_64"; Description: "{#AppName} VST3 Plugin 64-bit"; Types: full custom; Check: Is64BitInstallMode;

;%AAX_LEGACY%Name: "aax"; Description: "{#AppName} AAX Plugin"; Types: full custom;

; USER MANUAL
;%USER_MANUAL%Name: "user_manual"; Description: "{#AppName} User Manual"; Types: full custom;

[Files]

; Standalone
;%APP_32%Source: "{#AppName} x86.exe"; DestDir: "{app}"; Flags: ignoreversion; Components: app_32;
;%APP_64%Source: "{#AppName} x64.exe"; DestDir: "{app}"; Flags: ignoreversion; Components: app_64;
;%APP_32_LEGACY%Source: "{#AppName} x86 (L).exe"; DestDir: "{app}"; Flags: ignoreversion; Components: app_32;
;%APP_64_LEGACY%Source: "{#AppName} x64 (L).exe"; DestDir: "{app}"; Flags: ignoreversion; Components: app_64;

; VST
;%VST2_32%Source: "{#AppName} x86.dll"; DestDir: "{code:GetVST2Dir_32}"; Flags: ignoreversion; Components: vst2_32;
;%VST2_64%Source: "{#AppName} x64.dll"; DestDir: "{code:GetVST2Dir_64}"; Flags: ignoreversion; Components: vst2_64;
;%VST2_32_LEGACY%Source: "{#AppName} x86 (L).dll"; DestDir: "{code:GetVST2Dir_32}"; Flags: ignoreversion; Components: vst2_32;
;%VST2_64_LEGACY%Source: "{#AppName} x64 (L).dll"; DestDir: "{code:GetVST2Dir_64}"; Flags: ignoreversion; Components: vst2_64;

;%VST3_32%Source: "{#AppName} x86.vst3"; DestDir: "C:\Program Files (x86)\Common Files\VST3"; Flags: ignoreversion; Components: vst3_32;
;%VST3_64%Source: "{#AppName} x64.vst3"; DestDir: "C:\Program Files\Common Files\VST3"; Flags: ignoreversion; Components: vst3_64;
;%VST3_32_LEGACY%Source: "{#AppName} x86 (L).vst3"; DestDir: "C:\Program Files (x86)\Common Files\VST3"; Flags: ignoreversion; Components: vst3_32;
;%VST3_64_LEGACY%Source: "{#AppName} x64 (L).vst3"; DestDir: "C:\Program Files\Common Files\VST3"; Flags: ignoreversion; Components: vst3_64;

; AAX
;%AAX%Source: "{#AppName}.aaxplugin\*.*"; DestDir: "{cf}\Avid\Audio\Plug-Ins\{#AppName}.aaxplugin\"; Flags: ignoreversion recursesubdirs; Components: aax;
;%AAX_LEGACY%Source: "{#AppName}.aaxplugin\*.*"; DestDir: "{cf}\Avid\Audio\Plug-Ins\{#AppName}.aaxplugin\"; Flags: ignoreversion recursesubdirs; Components: aax;

; USER MANUAL
;%USER_MANUAL%Source: "{#AppName} User Manual.pdf"; DestDir: "{app}"; Flags: ignoreversion; Components: user_manual

[Icons]
;%APP_32%Name: "{group}\{#AppName}"; Filename: "{app}\{#AppName} x86.exe";
;%APP_64%Name: "{group}\{#AppName}"; Filename: "{app}\{#AppName} x64.exe";
;%APP_32_LEGACY%Name: "{group}\{#AppName}"; Filename: "{app}\{#AppName} x86 (L).exe";
;%APP_64_LEGACY%Name: "{group}\{#AppName}"; Filename: "{app}\{#AppName} x64 (L).exe";
Name: "{group}\Uninstall {#AppName}"; Filename: "{app}\unins000.exe"

[Code]
var
  OkToCopyLog : Boolean;
  VST2DirPage_32: TInputDirWizardPage;
  VST2DirPage_64: TInputDirWizardPage;

procedure InitializeWizard;

begin

  if IsWin64 then begin
    VST2DirPage_64 := CreateInputDirPage(wpSelectDir,
    'Confirm 64-Bit VST2 Plugin Directory', '',
    'Select the folder in which setup should install the 64-bit VST2 Plugin, then click Next.',
    False, '');
    VST2DirPage_64.Add('');
    VST2DirPage_64.Values[0] := ExpandConstant('{reg:HKLM\SOFTWARE\VST,VSTPluginsPath|{pf}\Steinberg\VSTPlugins}\');

    VST2DirPage_32 := CreateInputDirPage(wpSelectDir,
      'Confirm 32-Bit VST2 Plugin Directory', '',
      'Select the folder in which setup should install the 32-bit VST2 Plugin, then click Next.',
      False, '');
    VST2DirPage_32.Add('');
    VST2DirPage_32.Values[0] := ExpandConstant('{reg:HKLM\SOFTWARE\WOW6432NODE\VST,VSTPluginsPath|{pf32}\Steinberg\VSTPlugins}\');		
  end else begin
    VST2DirPage_32 := CreateInputDirPage(wpSelectDir,
      'Confirm 32-Bit VST2 Plugin Directory', '',
      'Select the folder in which setup should install the 32-bit VST2 Plugin, then click Next.',
      False, '');
    VST2DirPage_32.Add('');
    VST2DirPage_32.Values[0] := ExpandConstant('{reg:HKLM\SOFTWARE\VST,VSTPluginsPath|{pf}\Steinberg\VSTPlugins}\');
  end;
end;

function GetVST2Dir_32(Param: String): String;
begin
  Result := VST2DirPage_32.Values[0]
end;

function GetVST2Dir_64(Param: String): String;
begin
  Result := VST2DirPage_64.Values[0]
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssDone then
    OkToCopyLog := True;
end;

procedure DeinitializeSetup();
begin
  if OkToCopyLog then
    FileCopy (ExpandConstant ('{log}'), ExpandConstant ('{app}\InstallationLogFile.log'), FALSE);
  RestartReplace (ExpandConstant ('{log}'), '');
end;

[UninstallDelete]
Type: files; Name: "{app}\InstallationLogFile.log"
