// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "./ERC20Snapshot.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Paper is ERC20Snapshot, Ownable {
    // Dope Wars Loot: https://etherscan.io/address/0x8707276DF042E89669d69A177d3DA7dC78bd8723
    IERC721Enumerable public constant loot = IERC721Enumerable(0x8707276DF042E89669d69A177d3DA7dC78bd8723);
    // DopeDAO timelock: https://etherscan.io/address/0xb57ab8767cae33be61ff15167134861865f7d22c
    address public constant timelock = 0xB57Ab8767CAe33bE61fF15167134861865F7D22C;

    // Give out 1bn of tokens, evenly split across each NFT
    uint256 public constant paperPerTokenId = 1000000000e18 / 8000;

    // Track claimedTokens
    mapping(uint256 => bool) public claimedByTokenId;

    constructor() ERC20("Paper", "PAPER") ERC20Permit("PAPER") {
        transferOwnership(timelock);
    }

    function snapshot() external onlyOwner {
        _snapshot();
    }

    /// @notice Claim Paper for a given Dope Wars Loot ID
    /// @param tokenId The tokenId of the Dope Wars Loot NFT
    function claimById(uint256 tokenId) external {
        _claim(tokenId, _msgSender());
    }

    /** 
     * @notice Claim Paper for all tokens owned by the sender
     * @notice This function will run out of gas if you have too much loot! If
     * this is a concern, you should use claimRangeForOwner and claim Dope in
     * batches.
     */
    function claimAllForOwner() external {
        uint256 tokenBalanceOwner = loot.balanceOf(_msgSender());
        require(tokenBalanceOwner != 0, "NO_TOKENS_OWNED");

        for (uint256 i; i < tokenBalanceOwner; i++) {
            _claim(loot.tokenOfOwnerByIndex(_msgSender(), i), _msgSender());
        }
    }

    /**
     * @notice Claim Paper for all tokens owned by the sender within a
     * given range
     * @notice This function is useful if you own too much DWL to claim all at
     * once or if you want to leave some Paper unclaimed.
     */
    function claimRangeForOwner(uint256 ownerIndexStart, uint256 ownerIndexEnd) external {
        uint256 tokenBalanceOwner = loot.balanceOf(_msgSender());
        require(tokenBalanceOwner != 0, "NO_TOKENS_OWNED");

        // We use < for ownerIndexEnd and tokenBalanceOwner because
        // tokenOfOwnerByIndex is 0-indexed while the token balance is 1-indexed
        require(ownerIndexStart != 0 && ownerIndexEnd <= tokenBalanceOwner, "INDEX_OUT_OF_RANGE");

        // i <= ownerIndexEnd because ownerIndexEnd is 0-indexed
        for (uint256 i = ownerIndexStart; i <= ownerIndexEnd; i++) {
            _claim(loot.tokenOfOwnerByIndex(_msgSender(), i), _msgSender());
        }
    }

    /// @dev Internal function to mint Paper upon claiming
    function _claim(uint256 tokenId, address tokenOwner) internal {
        // Check that Paper have not already been claimed for a given tokenId
        require(!claimedByTokenId[tokenId], "PAPER_CLAIMED_FOR_TOKEN_ID");

        // Check that the sender owns the token that is being claimed, 
        // this will also throw if tokenID is higher than 8000 or its 0
        require(_msgSender() == loot.ownerOf(tokenId), "MUST_OWN_TOKEN_ID");

        // Mark that Paper has been claimed for the
        // given tokenId
        claimedByTokenId[tokenId] = true;

        // Send Paper to the owner of the token ID
        _mint(tokenOwner, paperPerTokenId);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
