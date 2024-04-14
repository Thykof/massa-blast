![alt text](https://d33wubrfki0l68.cloudfront.net/7df7d7a57a8dda3cc07aab16121b3e3990cf0893/16ccd/portfolio/massa.png)

# Dockerized Massa node

**Last build for Massa node version MAIN.2.1**

## Features

- Easy import your wallet from private key or .yaml file
- Persistent storage
- Auto update of your public IP (usefull for connections with dynamic ip)
- All docker features ( run in background, persistent logs, always restart)

## Quick install wizard

- download the folder
- create the `.env` file and populate it
- run `install-docker.sh`
- run `docker-compose up -d`

## Manual install

#### Requirements

- Install docker and docker-compose on your system

### How to setup

- Create a `docker-compose.yml` file. Copy the provided content below, and customize it by adding your specific environment variables.
- WALLETPWD is mandatory. It is the password to unlock your wallet. If you are importing wallet from private key, this password will be used to encrypt wallet backup file

#### Import wallet from .yaml file

- Create a `massa_mount` folder next to your `docker-compose.yml` file. Put your wallet .yaml file in it. That's it!

#### Available options:

- `DYNIP`: Set to "1" if you host under dynamic public IP. Disabled by default.
- `WALLETPWD`: Password used to encrypt wallet yaml file.
- `WALLET_PRIVATE_KEY`: Optional. Private key to import
- `NODE_MAX_RAM`: The app node will auto restart if RAM usage goes over this % threshold. Default to 99%.

### Manage your node:

- Start the container in detached mode:

```bash
sudo docker compose up -d
```

- Stop the container in detached mode:

```bash
sudo docker compose down
```

- Update your node to latest version and restart it:

```bash
sudo docker compose pull && sudo docker compose up -d
```

- See the node logs:

```bash
sudo docker compose logs
```

- Filter to get only Massa-guard logs:

```bash
sudo docker compose logs | grep Massa-Guard
```

- To enter your container:

```bash
sudo docker exec -it massa-core /bin/bash
```

- Using massa client to get node status:

```bash
sudo docker exec -t massa-core massa-cli get_status
```

- Using massa client to get your wallet info:

```bash
sudo docker exec -t massa-core massa-cli wallet_info
```

### Dashboard

- Dockprom stack to monitor your node.
  see https://github.com/enzofoucaud/dockmas

![image info](./img/dashboard.png)

### Log rotation

Logs from your running docker will accumulate with the time. To avoid the disk to be full, you can setup log rotation at Docker level.

Create or edit the file `/etc/docker/daemon.json`

```json
{
  "log-driver": "local",
  "log-opts": {
    "max-size": "15m",
    "max-file": "5"
  }
}
```

### IPV6

IPV6 is disabled by default.
To enable it in massa node edit the `massa_mount/node_config-<version>.toml` file. Set the `bootstrap_protocol` field under bootstrap section to "Both"

This part is highly experimental and has not been actively tested.

- Create or edit your host /etc/docker/daemon.json to add:

```json
{
  "ipv6": true,
  "fixed-cidr-v6": "fd00::/80"
}
```

- Restart docker service to reload config setting
- Allow MASQUERADE for ipv6

```console
ip6tables -t nat -A POSTROUTING -s fd00::/80 ! -o docker0 -j MASQUERADE
```

- Create a container which dynamicaly edit your iptables rules for port redirection

```console
docker run -d --restart=always -v /var/run/docker.sock:/var/run/docker.sock:ro --cap-drop=ALL --cap-add=NET_RAW --cap-add=NET_ADMIN --cap-add=SYS_MODULE --net=host --name ipv6nat robbertkl/ipv6nat
```

## [THANKS]

Thanks to **fsidhoum** and **dockyr** and **peterjah** for help
