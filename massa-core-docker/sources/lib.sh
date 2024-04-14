

green () { echo -e "Massa-Guard \033[01;32m$1\033[0m [$(date +%Y%m%d-%HH%M)] $2"; }

warn () { echo -e "Massa-Guard \033[01;33m$1\033[0m [$(date +%Y%m%d-%HH%M)] $2"; }

#############################################################
# FONCTION = WaitBootstrap
# DESCRIPTION = Wait node bootstrapping
#############################################################
WaitBootstrap() {
	# Wait node booststrap
	while true; do
		CheckNodeResponsive
		[ $? -eq 0 ] && break

		sleep 5s
	done

	green "INFO" "Successfully bootstraped"
}

#############################################################
# FUNCTION = GetWalletAddress
# DESCRIPTION = Get wallet public address
# RETURN = Wallet address
#############################################################
GetWalletAddress() {
	massa-cli -j wallet_info | jq -r '.[].address_info.address'
}

#############################################################
# FONCTION = CheckOrCreateWalletAndNodeKey
# DESCRIPTION = Load Wallet and Node key or create it and stake wallet
#############################################################
CheckOrCreateWalletAndNodeKey() {

	walletAddress=$(GetWalletAddress)

	## Create a wallet, stacke and backup
	# If wallet don't exist
	if [ -z "$walletAddress" ]
	then
		# Generate wallet
		massa-cli wallet_generate_secret_key > /dev/null
		walletAddress=$(GetWalletAddress)
		walletFile=wallet_$walletAddress.yaml
		green "INFO" "Wallet $walletAddress created"
	fi

	walletAddress=$(GetWalletAddress)

	# Backup wallet to the mount point
	if [ ! -e $PATH_MOUNT/$walletFile ]
	then
		walletFile=wallet_$walletAddress.yaml
		cp $PATH_CLIENT/wallets/$walletFile $PATH_MOUNT/$walletFile
		green "INFO" "Backup $walletFile"
	fi

	## Check if wallet is staked
	checkStackingKey=$(massa-cli -j node_get_staking_addresses | jq -r '.[]')

	if  [ "$checkStackingKey" != "$walletAddress" ]
	then
		# Stack wallet
		massa-cli node_start_staking $walletAddress > /dev/null
		green "INFO" "Start staking for $walletAddress"
	fi

	## Backup node_privkey
	if [ ! -e $PATH_MOUNT/node_privkey.key ]
	then
		cp $PATH_NODE_CONF/node_privkey.key $PATH_MOUNT/node_privkey.key
		green "INFO" "Backup $PATH_NODE_CONF/node_privkey.key to $PATH_MOUNT"

	fi
}

#############################################################
# FONCTION = CheckNodeRam
# DESCRIPTION = Buy roll if MAS amount > 200 or if candidate roll < 1 and MAS amount >= 100
# RETURN = NodeRamStatus 0 for OK Logs for KO
#############################################################
CheckNodeRam() {
	# Get ram consumption percent in integer
	checkRam=$(ps -u | awk '/massa-node/ && !/awk/' | awk '{print $4}')
	checkRam=${checkRam/.*}

	MAX_RAM=${NODE_MAX_RAM:-99}

	# If ram consumption is too high
	if ([ ! -z $checkRam ] && [ $checkRam -gt $MAX_RAM ])
	then
		warn "ERROR" "Max RAM usage treshold hit, restarting..."
		return 1
	fi
}

#############################################################
# FONCTION = CheckNodeResponsive
# DESCRIPTION = Check node vitality with get_status timeout
# RETURN = NodeResponsiveStatus 0 for OK Logs for KO
#############################################################
CheckNodeResponsive() {
	# Check node status and logs events
	checkGetStatus=$(timeout 2 massa-cli get_status | wc -l)

	# If get_status is responsive
	if [ $checkGetStatus -lt 10 ]
	then
		return 1
	fi
}

#############################################################
# FONCTION = RestartNode
# DESCRIPTION = restartNode

#############################################################
RestartNode() {
	pkill massa-node
}

#############################################################
# FONCTION = CheckPublicIP
# DESCRIPTION = Check if public IP is change and set it into config.toml
# RETURN = 0 for no change 1 for IP change
#############################################################
CheckPublicIP() {
	# Get Public IP of node
	myIP=$(GetPublicIP)

	# Get Public IP conf for node
	CONF_IP=$(toml get $PATH_NODE_CONF/config.toml protocol.routable_ip 2>/dev/null)

	# Check if configured IP equal to real IP
	if [ "$myIP" != "$confIP" ]; then
		# Return no change
		return 1
	fi
}

#############################################################
# FONCTION = RefreshPublicIP
# DESCRIPTION = Change Public IP into config.toml
# RETURN = 0 for ping done 1 for ping already got
#############################################################
RefreshPublicIP() {
	# Get Public IP of node
	myIP=$(GetPublicIP)

	# Check if get IP OK
	if [ -n "$myIP" ]; then
		# Update IP in your ref config.toml and restart node
		toml set $PATH_MOUNT/config.toml protocol.routable_ip "$myIP"
		RestartNode
	else
      warn "WARN" "Unable to retrieve public IP address"
	fi
}

#############################################################
# FONCTION = GetPublicIP
# DESCRIPTION = Get public IP
# RETURN = Node Public IP
#############################################################
GetPublicIP() {
	# Get mon IP
	myIP=$(curl -s checkip.amazonaws.com)

	# Return my public IP
	echo $myIP
}
