// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Minimal {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title Monadow — ERC-5564 (scheme 1) announcer + sender with on-chain announcement storage
contract Monadow {
    struct Ann {
        address stealthAddress;
        address caller;
        address token; // address(0) = native MON
        uint96 _pad;
        uint256 amount;
        bytes ephemeralPubKey;
        bytes1 viewTag;
        uint64 blockNumber;
    }

    uint256 public constant SCHEME_ID = 1;
    address internal constant NATIVE_SENTINEL = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    bytes4 internal constant NATIVE_SELECTOR = 0xeeeeeeee;
    bytes4 internal constant TRANSFER_SELECTOR = 0xa9059cbb;

    /// ERC-5564 event, exact signature.
    event Announcement(
        uint256 indexed schemeId, address indexed stealthAddress, address indexed caller, bytes ephemeralPubKey, bytes metadata
    );

    error InvalidEphemeralPubKey();
    error InvalidStealthAddress();
    error ZeroAmount();
    error NativeTransferFailed();
    error TokenTransferFailed();
    error Reentrancy();

    Ann[] internal _anns;
    bool private _locked;

    modifier nonReentrant() {
        if (_locked) revert Reentrancy();
        _locked = true;
        _;
        _locked = false;
    }

    /// @notice Send native MON to a stealth address and announce it.
    function sendNative(address stealth, bytes calldata ephemeralPubKey, bytes1 viewTag) external payable nonReentrant {
        _validate(stealth, ephemeralPubKey);
        if (msg.value == 0) revert ZeroAmount();

        _record(stealth, address(0), msg.value, ephemeralPubKey, viewTag);
        emit Announcement(
            SCHEME_ID,
            stealth,
            msg.sender,
            ephemeralPubKey,
            abi.encodePacked(viewTag, NATIVE_SELECTOR, NATIVE_SENTINEL, msg.value)
        );

        _sendNative(stealth, msg.value);
    }

    /// @notice Transfer `amount` of `token` from msg.sender to a stealth address, forwarding msg.value (MON gas tip) too.
    function sendToken(address token, uint256 amount, address stealth, bytes calldata ephemeralPubKey, bytes1 viewTag)
        external
        payable
        nonReentrant
    {
        _validate(stealth, ephemeralPubKey);
        if (amount == 0) revert ZeroAmount();

        _record(stealth, token, amount, ephemeralPubKey, viewTag);
        emit Announcement(
            SCHEME_ID, stealth, msg.sender, ephemeralPubKey, abi.encodePacked(viewTag, TRANSFER_SELECTOR, token, amount)
        );

        (bool ok, bytes memory ret) =
            token.call(abi.encodeWithSelector(IERC20Minimal.transferFrom.selector, msg.sender, stealth, amount));
        if (!ok || token.code.length == 0 || (ret.length != 0 && !abi.decode(ret, (bool)))) {
            revert TokenTransferFailed();
        }

        if (msg.value > 0) _sendNative(stealth, msg.value);
    }

    function announcementCount() external view returns (uint256) {
        return _anns.length;
    }

    /// @notice Paginated read of stored announcements; clamps to count.
    function getAnnouncements(uint256 start, uint256 limit) external view returns (Ann[] memory out) {
        uint256 count = _anns.length;
        if (start >= count) return new Ann[](0);
        uint256 end = count - start < limit ? count : start + limit;
        out = new Ann[](end - start);
        for (uint256 i = start; i < end; ++i) {
            out[i - start] = _anns[i];
        }
    }

    function _validate(address stealth, bytes calldata ephemeralPubKey) internal pure {
        if (stealth == address(0)) revert InvalidStealthAddress();
        if (ephemeralPubKey.length != 33) revert InvalidEphemeralPubKey();
    }

    function _record(address stealth, address token, uint256 amount, bytes calldata ephemeralPubKey, bytes1 viewTag)
        internal
    {
        _anns.push(
            Ann({
                stealthAddress: stealth,
                caller: msg.sender,
                token: token,
                _pad: 0,
                amount: amount,
                ephemeralPubKey: ephemeralPubKey,
                viewTag: viewTag,
                blockNumber: uint64(block.number)
            })
        );
    }

    function _sendNative(address to, uint256 value) internal {
        (bool ok,) = to.call{value: value}("");
        if (!ok) revert NativeTransferFailed();
    }
}
