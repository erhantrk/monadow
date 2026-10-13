// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {Monadow} from "../src/Monadow.sol";
import {MonadowRegistry} from "../src/MonadowRegistry.sol";
import {MockUSD} from "../src/MockUSD.sol";

/// forge script script/Deploy.s.sol --rpc-url $MONAD_RPC_URL --broadcast --slow
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        // Block at (just before) deployment: a safe lower bound for scanning.
        uint256 deployBlock = block.number;

        vm.startBroadcast(pk);
        Monadow monadow = new Monadow();
        MonadowRegistry registry = new MonadowRegistry();
        MockUSD mockUsd = new MockUSD();
        vm.stopBroadcast();

        console2.log("Monadow", address(monadow));
        console2.log("MonadowRegistry", address(registry));
        console2.log("MockUSD", address(mockUsd));
        console2.log("deployBlock", deployBlock);

        string memory k = "deployment";
        vm.serializeAddress(k, "Monadow", address(monadow));
        vm.serializeAddress(k, "MonadowRegistry", address(registry));
        vm.serializeAddress(k, "MockUSD", address(mockUsd));
        string memory json = vm.serializeUint(k, "deployBlock", deployBlock);
        vm.writeJson(json, string.concat(vm.projectRoot(), "/deployments/", vm.toString(block.chainid), ".json"));
    }
}
