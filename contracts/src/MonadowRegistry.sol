// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MonadowRegistry — ERC-6538 subset (stealth meta-address registry)
contract MonadowRegistry {
    event StealthMetaAddressSet(address indexed registrant, uint256 indexed schemeId, bytes stealthMetaAddress);

    /// registrant => schemeId => stealth meta-address (spendPub33 || viewPub33 for scheme 1)
    mapping(address => mapping(uint256 => bytes)) public stealthMetaAddressOf;

    function registerKeys(uint256 schemeId, bytes calldata stealthMetaAddress) external {
        stealthMetaAddressOf[msg.sender][schemeId] = stealthMetaAddress;
        emit StealthMetaAddressSet(msg.sender, schemeId, stealthMetaAddress);
    }
}
