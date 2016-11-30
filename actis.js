 var app = angular.module("ActisApp", ["ngCookies", "ngSanitize"]);

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
//Init app
app.run(function ($rootScope, uiService) {
  $rootScope.settings = {
    peerUri : "http://127.0.0.1:8545",
    web3 : null,
    reloadInterval: 1500,
		blockCount:7,
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
	 //pending block
	 pendingBlock: null,
	 //show progress bar
	 showProgress : false
 }

 uiService.initUI();
});

app.service('uiService', function ($rootScope, $location, $http, $timeout, $interval) {
  var self = this;
  var blockArr = null;

  this.initUI = function () {
    blockArr = $rootScope.ui.blockArr;
		$rootScope.ui.reloadInterval = $interval(function(){self.loadData()}, $rootScope.settings.reloadInterval);
  }

  this.loadData = function (){
			var web3 = $rootScope.settings.web3;

			if (web3 != null){
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
								if (blockArr.length > $rootScope.settings.blockCount){
									blockArr.pop();
								}
							}
						}
				 }
				});

				web3.eth.getBlock("pending", function(error, block){
					if(error){
							alert(error);
					}else{
							$rootScope.ui.pendingBlock = block;
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
			}
  	}
});

app.controller('mainController', ['$scope', '$rootScope', '$timeout','$interval','uiService', function($scope, $rootScope, $timeout, $interval, uiService) {
	$scope.userTabs = {};
	$scope.tabSelected = "";
	var web3;

	$scope.applySettings = function (formObj) {
		web3 = new Web3(new Web3.providers.HttpProvider($rootScope.settings.peerUri));
		if(web3.isConnected()) {
				$rootScope.settings.web3 = web3;
				$rootScope.ui.networkProtocolVer = web3.version.network;
				$rootScope.ui.ethProtocolVer = web3.version.ethereum;

				$('#settingsModal').modal('hide');
		}else{
				$scope.settingsErr = "Can't connect to node !"
		}
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
				//web3.eth.getBlock("latest")
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
				for (var i = 0; i <  len;i++  ){
						tx = block.transactions[i];
						//to
						if (tx.to == null){
							 //if created contract, field "to" is null, we should use getTransactionReceipt to recognize a contract address
								var txReceipt = web3.eth.getTransactionReceipt(tx.hash);
								if (txReceipt.contractAddress == null){
										//contract not mined
									tx.toContr = "E";
								}else{
									tx.toContr = "M";
									tx.to = txReceipt.contractAddress;
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
				$scope.addTab($scope.infoSearch, addrObj);
				$rootScope.ui.showProgress = false;
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
