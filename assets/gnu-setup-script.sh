#!/bin/bash
for file in *; do 
    if [ -f "$file" ] && [[ "$file" != *".sh" ]]; then

      read -r -p "Would you like to install $file?" install

      if [[ "$install" =~ ^([yY][eE][sS]|[yY])+$ ]]
      then
          echo "Please enter the location to install the plugin file."
          read path

          until [ -d "$path" ]; do
           echo "The path does not exist or is not accessible. Please try a different path."
           read path
          done

          cp -i "$file" "$path"
      else
          echo "$file will not be installed"
      fi
    fi
done

echo "The software installation is complete."