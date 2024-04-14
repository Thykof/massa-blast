
#!/bin/bash

echo "installing docker"
sudo apt-get update
sudo apt-get install -y curl
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh ./get-docker.sh
rm get-docker.sh

curl -fsSL https://raw.githubusercontent.com/peterjah/massa-core-docker/main/docker-compose.yml -o docker-compose.yml
