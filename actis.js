 var app = angular.module("ActisApp", ["LocalStorageModule", "ngSanitize"]);

app.filter('utc', function(){
	return function(val){
	  var date = new Date(val * 1000);
	  return new Date(date.getUTCFullYear(),
	                    date.getUTCMonth(),
	                    date.getUTCDate(),
	                    date.getUTCHours(),
	                    date.getUTCMinutes(),
	                    date.getUTCSeconds());
	};
}).filter('units', function($rootScope){
	return function(val, unit){
		 if ( typeof val == "undefined" || val==""){
			 return "";
		 }else{
			 return $rootScope.settings.web3.fromWei(val, unit).toNumber();
		 }
	}
}).filter('unitsSimpleNumber', function($rootScope){
	return function(val, unit){
		 if ( typeof val == "undefined" || val==""){
			 return "";
		 }else{
			 return $rootScope.settings.web3.fromWei(val, unit);
		 }
	}
});

function isNumberKey(evt, objInput){
	var charCode = (evt.which) ? evt.which : evt.keyCode;
	if (charCode == 46 && (objInput.value.split('.').length > 1 || objInput.value.length == 0)) {
		return false;
	}else if (charCode != 37 && charCode != 39 && charCode != 46 && charCode > 31 && (charCode < 48 || charCode > 57)){
	 	return false;
	}
	return true;
}

var STORAGE_KEY_ACTIS_CONFIG = "actis.config";
var STORAGE_CONTRACT_PREFFIX = "contr."

app.config(function (localStorageServiceProvider) {
  localStorageServiceProvider.setPrefix('actis').setStorageType('localStorage').setNotify(true, true);
});
//Init app
app.run(function ($rootScope, uiService, localStorageService) {
 //load from storage configuration
  $rootScope.appConfig = localStorageService.get(STORAGE_KEY_ACTIS_CONFIG);
  if ($rootScope.appConfig == null){
    $rootScope.appConfig = {
      peers:{}
    }

    $rootScope.appConfig.peers["localhost"]={peerName:"localhost", peerUri:"http://127.0.0.1:8545", blockCount:7};

  }

  $rootScope.settings = {
    //selected peer
    peerName:null,
    web3 : null,
    reloadInterval: 2000,
		//current value unit
		unit:"wei",
		units:["wei", "kwei", "mwei", "gwei","szabo", "finney","ether","kether","mether","gether","tether"]
  }

 	$rootScope.ui = {
   reloadInterval : null,
   blockArr : [],
	 networkProtocolVer : 0,
	 //the ethereum protocol version.
	 ethProtocolVer : 0,
	 //number of hashes per second that the node is mining with.
	 hashRate : 0,
	 //the gas price is determined by the x latest blocks median gas price.
	 gasPrice : 0,
	 //whether the node is mining or not.
	 mining : false,
	 //show progress bar
	 showProgress : false,
        //last block
     lastBlockNumber : 0

 }

 uiService.initUI();
});

app.service('uiService', function ($rootScope, $http, $timeout, $interval) {
  var self = this;

  this.initUI = function () {
    $rootScope.settings.peer = $rootScope.appConfig.peers["localhost"];
		$rootScope.ui.reloadInterval = $interval(function(){self.loadData()}, $rootScope.settings.reloadInterval);
  }

  this.loadData = function (){
      var blockArr = $rootScope.ui.blockArr;
			var web3 = $rootScope.settings.web3;

			if (web3 != null){
                var lastBlock = web3.eth.blockNumber;

                if (lastBlock > $rootScope.ui.lastBlockNumber) {
                    web3.eth.getBlock("latest", function(error, block){
                        if(error){
                            alert(error);
                        }else{
                            if (blockArr.length == 0){
                                blockArr.push(block);
                            }else{
                                //add only latest block
                                if (blockArr[0].number != block.number){
                                    blockArr.unshift(block);
                                    if (blockArr.length > $rootScope.settings.peer.blockCount){
                                        blockArr.pop();
                                    }
                                }
                            }
                        }
                    });

                    web3.eth.getHashrate(function(error, result){
                        if(error){
                            alert(error);
                        }else{
                            $rootScope.ui.hashRate = result;
                        }
                    });

                    web3.eth.getGasPrice(function(error, result){
                        if(error){
                            alert(error);
                        }else{
                            $rootScope.ui.gasPrice = result;
                        }
                    });

                    web3.eth.getMining(function(error, result){
                        if(error){
                            alert(error);
                        }else{
                            $rootScope.ui.mining = result;
                        }
                    });

                    $rootScope.ui.lastBlockNumber = lastBlock;
                }

			}
  	}
});

app.controller('mainController', ['$scope', '$rootScope', '$timeout','$interval','uiService','localStorageService', function($scope, $rootScope, $timeout, $interval, uiService, localStorageService) {
	$scope.userTabs = {};
	$scope.tabSelected = "";
	var web3;
  $scope.peer = {};
  $scope.contractDetails = {};

 $scope.switchPeer = function(peerName){
     $scope.peer = $rootScope.appConfig.peers[peerName];
 }
 $scope.deletePeer = function(peerName){
     $scope.peer = null;
     delete $rootScope.appConfig.peers[peerName];
     localStorageService.set(STORAGE_KEY_ACTIS_CONFIG, $rootScope.appConfig);
 }
 $scope.addPeer = function(){
     $scope.peer = {blockCount:7}
 }
 $scope.savePeer = function(){
     $rootScope.appConfig.peers[$scope.peer.peerName]=$scope.peer;
     localStorageService.set(STORAGE_KEY_ACTIS_CONFIG, $rootScope.appConfig);
 }
 $scope.connectToPeer = function (formObj) {
   $scope.settingsErr = null;
   $rootScope.ui.blockArr = [];
   $rootScope.settings.peerName =  $scope.peer.peerName;
		web3 = new Web3(new Web3.providers.HttpProvider($scope.peer.peerUri));
		if(web3.isConnected()) {
				$rootScope.settings.web3 = web3;
				$rootScope.ui.networkProtocolVer = web3.version.network;
				$rootScope.ui.ethProtocolVer = web3.version.ethereum;

				$('#settingsModal').modal('hide');
		}else{
				$scope.settingsErr = "Can't connect to peer !"
		}
	}

  $scope.showContractsCovernance = function (address){
      var keys = localStorageService.keys();
      $scope.contracts = {};
      $scope.addTab("contracts", $scope.contracts);
      for (index in keys){
          if(keys[index].startsWith(STORAGE_CONTRACT_PREFFIX)){
            contract = localStorageService.get(keys[index]);
            $scope.contracts[contract.contractAddress] = contract;
          }
      }
  }
  /*
    Contract details
  */
  $scope.addContract = function (formObj){
      //trim and remove \" if code copied from abigen result (contract golang binding source)
      $scope.contractDetails.contractABI =  ($scope.contractDetails.contractABI + "").trim().replace(/\\/g, '');
      localStorageService.set(STORAGE_CONTRACT_PREFFIX + $scope.contractDetails.contractAddress, $scope.contractDetails);
      $scope.contracts[$scope.contractDetails.contractAddress] = $scope.contractDetails;
      $scope.contractDetails = { contractAddress:"", contractName:"", contractVersion:""};
  }
  $scope.deleteContract = function (contractAddress){
      localStorageService.remove(STORAGE_CONTRACT_PREFFIX + contractAddress);
      $scope.contractDetails = { contractAddress:"", contractName:"", contractVersion:""};
      delete $scope.contracts[contractAddress];
  }
  $scope.editContract = function (contractAddress){
      $scope.contractDetails = $scope.contracts[contractAddress];
  }

	//search
	$scope.searchComponent = function (){
		$scope.infoSearch = ""
		var searchStr = $scope.searchString.trim();
		var tabId = ""

		if (searchStr.startsWith("0x")){
			if (searchStr.length == 42){
				//address
				$scope.openAddressTab(searchStr);
			}else if (searchStr.length == 66){
				//tx ?
				var tx = web3.eth.getTransaction(searchStr);
				if (tx == null){
					//block
					$scope.openBlockTab (searchStr);
				}else{
					$scope.infoSearch = "tx " + searchStr;
					var txReceipt = web3.eth.getTransactionReceipt(searchStr)
					$scope.addTab($scope.infoSearch, Object.assign(tx, txReceipt));
				}
			}
		}else{
			var blockNumber = parseInt(searchStr);
			if (Number.isNaN(blockNumber)){
				tabId = "Can't recognize input string";
			}else{
				//block number
				if (blockNumber > -1){
						$scope.openBlockTab (blockNumber);
				}else{
					tabId = "Invalid block number"
				}
			}
		}

		$scope.infoSearch = tabId;
		$scope.searchString = "";
	}
	//blockId is hash or number
	$scope.openBlockTab = function (blockId){
		$rootScope.ui.showProgress = true;
		web3.eth.getBlock(blockId, true, function(error, block){
			if(error){
					$rootScope.ui.showProgress = false;
					alert(error);
			}else{
				$scope.infoSearch = "block " + blockId;
				block.extraData = web3.toAscii(block.extraData);

				$scope.addTab($scope.infoSearch, block);
				$rootScope.ui.showProgress = false;

				var len = block.transactions.length;
				var tx = null;
				//is addresses as contract ?
				for (var i = 0; i <  len; i++ ){
						tx = block.transactions[i];
						//to
						if (tx.to == null){
							 //if created contract, field "to" is null, we should use getTransactionReceipt to recognize a contract address
								var txReceipt = web3.eth.getTransactionReceipt(tx.hash);

								if (txReceipt.contractAddress == null){
										//contract not mined
									tx.toContr = "E";
                  tx.to = "Err. Contract not mined !";
								}else{
                    //we should check contract code. If contract created with error.
                   var code = web3.eth.getCode(txReceipt.contractAddress);
                   if (code == "0x"){
                     		tx.toContr = "E";
                        tx.to = "Err. Contract not saved at state !";
                   }else{
                     tx.toContr = "M";
                     tx.to = txReceipt.contractAddress;
                   }
								}
						}else{
							if (web3.eth.getCode(tx.to) == "0x"){
								tx.toContr = "";
							}else{
								tx.toContr = "C";
							}
						}
				}
		 }
		});
	}

	$scope.openTxTab = function (txId){
		$rootScope.ui.showProgress = true;
		web3.eth.getTransaction(txId, function(error, tx){
			if(error){
					$rootScope.ui.showProgress = false;
					alert(error);
			}else{
				$scope.infoSearch = "tx " + txId;
				var txReceipt = web3.eth.getTransactionReceipt(txId);
				$scope.addTab($scope.infoSearch, Object.assign(tx, txReceipt));
				$rootScope.ui.showProgress = false;
		 }
		});
	}

	$scope.openAddressTab = function (address){
		$rootScope.ui.showProgress = true;
		var addrObj = {
			address:"",
			balance : 0,
			storageAt: "",
			code: "",
			txCount:0
		}
		web3.eth.getBalance(address, "latest", function(error, value){
			if(error){
					$rootScope.ui.showProgress = false;
					alert(error);
			}else{
				$scope.infoSearch = "addr " + address;
				addrObj.address = address;
				addrObj.balance = value;
				addrObj.storageAt = web3.eth.getStorageAt(address, 0);
				addrObj.code = web3.eth.getCode(address);
				addrObj.txCount = 	web3.eth.getTransactionCount(address);
        addrObj.eventArr = [];
				$scope.addTab($scope.infoSearch, addrObj);
				$rootScope.ui.showProgress = false;
        //try get contract details from local storage
        var contractDetails = localStorageService.get(STORAGE_CONTRACT_PREFFIX + address);
        if (contractDetails != null){
            addrObj.contractDetails = contractDetails;
            var contract = web3.eth.contract(JSON.parse(contractDetails.contractABI));
            var contractInstance = contract.at(address);

            var events = contractInstance.allEvents({fromBlock: 0, toBlock: 'latest'});
            events.watch(function(error, result){
            	addrObj.eventArr.unshift(result);
            });
        }
		 }
		});
	}

	$scope.selectTab = function(tabId){
			$scope.tabSelected =  tabId;
	}

	$scope.addTab = function(tabId, object){
		$scope.userTabs [tabId] =  object;
		$scope.tabSelected =	tabId;
	}

	$scope.closeTab = function(tabId){
			delete $scope.userTabs [tabId];
			$scope.tabSelected =	Object.keys($scope.userTabs)[0];
	}

}]);
