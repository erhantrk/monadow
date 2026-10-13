// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, Vm} from "forge-std/Test.sol";
import {Monadow} from "../src/Monadow.sol";
import {MonadowRegistry} from "../src/MonadowRegistry.sol";
import {MockUSD} from "../src/MockUSD.sol";

contract Rejector {
    receive() external payable {
        revert("no");
    }
}

contract Reenterer {
    Monadow public m;
    bool public attempted;
    bool public reentryBlocked;

    constructor(Monadow _m) {
        m = _m;
    }

    receive() external payable {
        if (!attempted) {
            attempted = true;
            try m.sendNative{value: msg.value}(address(0xBEEF), _key(), 0x01) {
                reentryBlocked = false;
            } catch (bytes memory err) {
                reentryBlocked = bytes4(err) == Monadow.Reentrancy.selector;
            }
        }
    }

    function _key() internal pure returns (bytes memory) {
        return abi.encodePacked(bytes1(0x02), bytes32(uint256(1)));
    }
}

/// ERC-20 that returns false instead of reverting.
contract FalseToken {
    function transferFrom(address, address, uint256) external pure returns (bool) {
        return false;
    }
}

contract MonadowTest is Test {
    event Announcement(
        uint256 indexed schemeId, address indexed stealthAddress, address indexed caller, bytes ephemeralPubKey, bytes metadata
    );
    event StealthMetaAddressSet(address indexed registrant, uint256 indexed schemeId, bytes stealthMetaAddress);

    Monadow m;
    MonadowRegistry reg;
    MockUSD usd;

    address alice = makeAddr("alice");
    address stealth = makeAddr("stealth");
    bytes ephKey = abi.encodePacked(bytes1(0x02), keccak256("eph"));
    bytes1 tag = 0xab;

    function setUp() public {
        m = new Monadow();
        reg = new MonadowRegistry();
        usd = new MockUSD();
        vm.deal(alice, 100 ether);
    }

    // ---------------- Registry ----------------

    function test_registry_register() public {
        bytes memory meta = abi.encodePacked(bytes1(0x02), bytes32(uint256(1)), bytes1(0x03), bytes32(uint256(2)));
        assertEq(meta.length, 66);
        vm.expectEmit(true, true, false, true, address(reg));
        emit StealthMetaAddressSet(alice, 1, meta);
        vm.prank(alice);
        reg.registerKeys(1, meta);
        assertEq(reg.stealthMetaAddressOf(alice, 1), meta);
        assertEq(reg.stealthMetaAddressOf(alice, 2).length, 0);

        bytes memory meta2 = abi.encodePacked(bytes1(0x03), bytes32(uint256(9)), bytes1(0x02), bytes32(uint256(8)));
        vm.prank(alice);
        reg.registerKeys(1, meta2);
        assertEq(reg.stealthMetaAddressOf(alice, 1), meta2);
    }

    // ---------------- MockUSD ----------------

    function test_mockusd_metadata() public view {
        assertEq(usd.name(), "Monadow USD");
        assertEq(usd.symbol(), "mUSD");
        assertEq(usd.decimals(), 6);
    }

    function test_mockusd_mint_transfer_approve() public {
        usd.mint(alice, 1000e6);
        assertEq(usd.balanceOf(alice), 1000e6);
        assertEq(usd.totalSupply(), 1000e6);
        vm.prank(alice);
        usd.transfer(stealth, 10e6);
        assertEq(usd.balanceOf(stealth), 10e6);
        vm.prank(alice);
        usd.approve(address(this), 5e6);
        usd.transferFrom(alice, stealth, 5e6);
        assertEq(usd.allowance(alice, address(this)), 0);
        assertEq(usd.balanceOf(alice), 985e6);
        vm.expectRevert("ERC20: insufficient allowance");
        usd.transferFrom(alice, stealth, 1);
        vm.prank(alice);
        vm.expectRevert("ERC20: insufficient balance");
        usd.transfer(stealth, 1e18);
    }

    function test_mockusd_infiniteAllowance() public {
        usd.mint(alice, 10e6);
        vm.prank(alice);
        usd.approve(address(this), type(uint256).max);
        usd.transferFrom(alice, stealth, 3e6);
        assertEq(usd.allowance(alice, address(this)), type(uint256).max);
    }

    // ---------------- sendNative ----------------

    function test_sendNative_forwards_and_stores() public {
        vm.roll(1234);
        vm.prank(alice);
        m.sendNative{value: 1.5 ether}(stealth, ephKey, tag);
        assertEq(stealth.balance, 1.5 ether);
        assertEq(address(m).balance, 0);
        assertEq(m.announcementCount(), 1);
        Monadow.Ann[] memory a = m.getAnnouncements(0, 10);
        assertEq(a.length, 1);
        assertEq(a[0].stealthAddress, stealth);
        assertEq(a[0].caller, alice);
        assertEq(a[0].token, address(0));
        assertEq(a[0]._pad, 0);
        assertEq(a[0].amount, 1.5 ether);
        assertEq(a[0].ephemeralPubKey, ephKey);
        assertEq(a[0].viewTag, tag);
        assertEq(a[0].blockNumber, 1234);
    }

    function test_sendNative_event_metadata() public {
        uint256 amount = 0.25 ether;
        // viewTag(1) || 0xeeeeeeee(4) || 0xEeee..EeE(20) || amount(32) = 57 bytes
        bytes memory expected = abi.encodePacked(
            tag, bytes4(0xeeeeeeee), address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE), uint256(amount)
        );
        assertEq(expected.length, 57);
        assertEq(uint8(expected[0]), 0xab);
        for (uint256 i = 1; i < 25; i++) assertEq(uint8(expected[i]), 0xee);

        vm.expectEmit(true, true, true, true, address(m));
        emit Announcement(1, stealth, alice, ephKey, expected);
        vm.prank(alice);
        m.sendNative{value: amount}(stealth, ephKey, tag);
    }

    function test_announcement_topic0_is_erc5564() public {
        vm.recordLogs();
        vm.prank(alice);
        m.sendNative{value: 1}(stealth, ephKey, tag);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 1);
        assertEq(logs[0].topics[0], keccak256("Announcement(uint256,address,address,bytes,bytes)"));
        assertEq(logs[0].topics[1], bytes32(uint256(1)));
        assertEq(logs[0].topics[2], bytes32(uint256(uint160(stealth))));
        assertEq(logs[0].topics[3], bytes32(uint256(uint160(alice))));
        (bytes memory eph, bytes memory meta) = abi.decode(logs[0].data, (bytes, bytes));
        assertEq(eph, ephKey);
        assertEq(meta.length, 57);
    }

    function test_sendNative_reverts_badKey() public {
        vm.startPrank(alice);
        vm.expectRevert(Monadow.InvalidEphemeralPubKey.selector);
        m.sendNative{value: 1}(stealth, abi.encodePacked(bytes32(0)), tag);
        vm.expectRevert(Monadow.InvalidEphemeralPubKey.selector);
        m.sendNative{value: 1}(stealth, abi.encodePacked(bytes32(0), bytes2(0)), tag);
        vm.expectRevert(Monadow.InvalidEphemeralPubKey.selector);
        m.sendNative{value: 1}(stealth, "", tag);
        vm.stopPrank();
    }

    function test_sendNative_reverts_zeroStealthOrValue() public {
        vm.startPrank(alice);
        vm.expectRevert(Monadow.InvalidStealthAddress.selector);
        m.sendNative{value: 1}(address(0), ephKey, tag);
        vm.expectRevert(Monadow.ZeroAmount.selector);
        m.sendNative(stealth, ephKey, tag);
        vm.stopPrank();
    }

    function test_sendNative_reverts_onRejectingRecipient() public {
        Rejector r = new Rejector();
        vm.prank(alice);
        vm.expectRevert(Monadow.NativeTransferFailed.selector);
        m.sendNative{value: 1 ether}(address(r), ephKey, tag);
        assertEq(m.announcementCount(), 0);
        assertEq(alice.balance, 100 ether);
    }

    function test_reentrancy_blocked() public {
        Reenterer r = new Reenterer(m);
        vm.prank(alice);
        m.sendNative{value: 1 ether}(address(r), ephKey, tag);
        assertTrue(r.attempted());
        assertTrue(r.reentryBlocked());
        assertEq(m.announcementCount(), 1);
        assertEq(address(r).balance, 1 ether);
    }

    // ---------------- sendToken ----------------

    function _fundToken(uint256 amt) internal {
        usd.mint(alice, amt);
        vm.prank(alice);
        usd.approve(address(m), amt);
    }

    function test_sendToken_transfers_and_tip() public {
        _fundToken(100e6);
        vm.roll(777);
        vm.prank(alice);
        m.sendToken{value: 0.02 ether}(address(usd), 40e6, stealth, ephKey, tag);
        assertEq(usd.balanceOf(stealth), 40e6);
        assertEq(usd.balanceOf(alice), 60e6);
        assertEq(stealth.balance, 0.02 ether);
        assertEq(address(m).balance, 0);
        Monadow.Ann[] memory a = m.getAnnouncements(0, 1);
        assertEq(a[0].token, address(usd));
        assertEq(a[0].amount, 40e6);
        assertEq(a[0].caller, alice);
        assertEq(a[0].blockNumber, 777);
    }

    function test_sendToken_noTip() public {
        _fundToken(5e6);
        vm.prank(alice);
        m.sendToken(address(usd), 5e6, stealth, ephKey, tag);
        assertEq(usd.balanceOf(stealth), 5e6);
        assertEq(stealth.balance, 0);
    }

    function test_sendToken_event_metadata() public {
        _fundToken(100e6);
        uint256 amount = 12_345_678;
        bytes memory expected = abi.encodePacked(tag, bytes4(0xa9059cbb), address(usd), uint256(amount));
        assertEq(expected.length, 57);
        vm.expectEmit(true, true, true, true, address(m));
        emit Announcement(1, stealth, alice, ephKey, expected);
        vm.prank(alice);
        m.sendToken(address(usd), amount, stealth, ephKey, tag);
    }

    function test_sendToken_reverts() public {
        _fundToken(1e6);
        vm.startPrank(alice);
        vm.expectRevert(Monadow.InvalidEphemeralPubKey.selector);
        m.sendToken(address(usd), 1e6, stealth, hex"02", tag);
        vm.expectRevert(Monadow.ZeroAmount.selector);
        m.sendToken(address(usd), 0, stealth, ephKey, tag);
        vm.expectRevert(Monadow.InvalidStealthAddress.selector);
        m.sendToken(address(usd), 1e6, address(0), ephKey, tag);
        // insufficient allowance/balance
        vm.expectRevert(Monadow.TokenTransferFailed.selector);
        m.sendToken(address(usd), 2e6, stealth, ephKey, tag);
        // not a contract
        vm.expectRevert(Monadow.TokenTransferFailed.selector);
        m.sendToken(address(0x1234), 1, stealth, ephKey, tag);
        // returns false
        FalseToken ft = new FalseToken();
        vm.expectRevert(Monadow.TokenTransferFailed.selector);
        m.sendToken(address(ft), 1, stealth, ephKey, tag);
        // tip to rejecting recipient
        Rejector r = new Rejector();
        vm.expectRevert(Monadow.NativeTransferFailed.selector);
        m.sendToken{value: 1}(address(usd), 1e6, address(r), ephKey, tag);
        vm.stopPrank();
        assertEq(m.announcementCount(), 0);
    }

    // ---------------- pagination ----------------

    function test_getAnnouncements_pagination() public {
        vm.startPrank(alice);
        for (uint256 i = 0; i < 5; i++) {
            m.sendNative{value: i + 1}(address(uint160(0x1000 + i)), ephKey, bytes1(uint8(i)));
        }
        vm.stopPrank();
        assertEq(m.announcementCount(), 5);
        assertEq(m.getAnnouncements(0, 10).length, 5);
        assertEq(m.getAnnouncements(0, 0).length, 0);
        assertEq(m.getAnnouncements(5, 10).length, 0);
        assertEq(m.getAnnouncements(100, 10).length, 0);
        Monadow.Ann[] memory a = m.getAnnouncements(1, 2);
        assertEq(a.length, 2);
        assertEq(a[0].amount, 2);
        assertEq(a[1].amount, 3);
        assertEq(a[1].viewTag, bytes1(uint8(2)));
        a = m.getAnnouncements(3, 100);
        assertEq(a.length, 2);
        assertEq(a[1].stealthAddress, address(uint160(0x1004)));
        // overflow-safe with huge limit
        assertEq(m.getAnnouncements(2, type(uint256).max).length, 3);
    }

    function testFuzz_sendNative(uint96 amount, bytes32 x, uint8 t) public {
        vm.assume(amount > 0);
        bytes memory k = abi.encodePacked(bytes1(0x03), x);
        vm.deal(alice, amount);
        vm.prank(alice);
        m.sendNative{value: amount}(stealth, k, bytes1(t));
        assertEq(stealth.balance, amount);
        Monadow.Ann[] memory a = m.getAnnouncements(0, 1);
        assertEq(a[0].ephemeralPubKey, k);
        assertEq(a[0].viewTag, bytes1(t));
    }
}
