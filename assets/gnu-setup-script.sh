#!/bin/bash
if (($EUID != 0)); then
  if [[ -t 1 ]]; then
    sudo "$0" "$@"
  fi
  exit
fi

USER_HOME=$(getent passwd $SUDO_USER | cut -d: -f6)
standalone_name="%STANDALONE_NAME%"
so_path="$USER_HOME/.vst"
vst3_path="$USER_HOME/.vst3"
standalone_path="/opt/%COMPANY_NAME%"
legacy=%LEGACY%
install_type=1
path=""

echo ""
echo ""
echo "--------------------------------------------------"
echo "%PROJECT_NAME% Installation Script."
echo "--------------------------------------------------"
echo ""

if [[ "$legacy" == 1 ]]; then
  echo "[1] Standard install."
  echo "[2] Legacy install (for pre-2010 AMD CPUs)."

  echo ""
  read -r -p "Please choose an option: " install_type
fi

for file in *; do 
  if [[ -f "$file" ]] && [[ "$file" != *".sh" ]] && [[ "$file" != *".txt" ]]; then
    if [[ "$file" != *".so" && ( "$file" != *".vst3" && "$file" != "$standalone_name" ) || ( $install_type = 1 && "$file" != *"(L)"* ) || (( $install_type = 2 && "$file" == *"(L)"* )) ]]; then

      file_type=""
        
      if [[ "$file" == *".so" ]]; then 
        file_type="VST2 Plugin"
      fi

      if [[ "$file" == *".vst3" ]]; then 
        file_type="VST3 Plugin"
      fi

      if [[ "$file" == "$standalone_name" ]]; then 
        file_type="Standalone Application"
      fi
        
      if [[ "$file" == *".pdf" ]]; then 
        file_type="User Manual"
      fi
        
      read -r -p "Install the $file_type? (y/n): " install

      if [[ "$install" =~ ^([yY][eE][sS]|[yY])+$ ]]; then
          
        if [[ "$file" == *".so" ]]; then
          path="$so_path"
          cp -i "$file" "$so_path"
          chown "$SUDO_USER" "$so_path/$file"
          echo "$file installed at $so_path"
        fi
            
        if [[ "$file" == *".vst3" ]]; then 
          path="$vst3_path"
          cp -i "$file" "$vst3_path"
          echo "$file installed at $vst3_path"
        fi

        if [[ "$file" == "$standalone_name" || ( "$file" == *".pdf" ) ]]; then
              
          read -r -p "Install this file in $standalone_path? " default            
              
          if [[ "$default" =~ ^([yY][eE][sS]|[yY])+$ ]]; then
                
            if [[ ! -d "$standalone_path" ]]; then 
              read -r -p "$standalone_path does not exist. Would you like to create it? (y/n): " create
                  
              if [[ "$create" =~ ^([yY][eE][sS]|[yY])+$ ]]; then
                mkdir "$standalone_path"
              fi
            fi
          else
            echo "Please specify an install location."
            read standalone_path
          fi
              
          until [ -d "$standalone_path" ]; do
            read -r -p "$standalone_path does not exist. Would you like to create it? (y/n): " create
        
            if [[ "$create" =~ ^([yY][eE][sS]|[yY])+$ ]]; then
              mkdir "$standalone_path"
            else 
              echo "Please specify an install location."
              read standalone_path
            fi
          done

          path="$standalone_path"
        fi
        
        if [[ "$path" != "" ]]; then
          cp -i "$file" "$path"
          chown "$SUDO_USER":"$SUDO_USER" "$path/$file"
          chmod 775 "$path/$file"
          echo "$file installed at $path"
        fi        
      fi
    fi
  fi
done

echo "The software installation is complete."