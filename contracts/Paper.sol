// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts@4.3.0/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts@4.3.0/token/ERC20/extensions/ERC20Snapshot.sol";
import "@openzeppelin/contracts@4.3.0/token/ERC721/extensions/IERC721Enumerable.sol";
import "@openzeppelin/contracts@4.3.0/access/Ownable.sol";

contract Paper is ERC20, ERC20Snapshot, Ownable {
    // Dope Wars Loot contract is available at https://etherscan.io/address/0x8707276DF042E89669d69A177d3DA7dC78bd8723
    IERC721Enumerable public dopeWarsLootContract = IERC721Enumerable(0x8707276DF042E89669d69A177d3DA7dC78bd8723);

    // 8000 tokens number 1-8000
    uint256 public tokenIdStart = 1;
    uint256 public tokenIdEnd = 8000;

    // Give out 50% of tokens, evenly split across each NFT
    uint256 public supply = 1000000000 * (10**decimals());
    uint256 public paperPerTokenId = supply / 2 / tokenIdEnd ;
    
    // track claimedTokens
    mapping(uint256 => bool) public claimedByTokenId;
    
    // TODO verify?
    address public daoAddress = 0x8707276DF042E89669d69A177d3DA7dC78bd8723;
    
    constructor() ERC20("Paper", "PAPER") {
        transferOwnership(daoAddress);
        dopeWarsLootContract = IERC721Enumerable(dopeWarsLootContractAddress);
        _mint(daoAddress, supply / 2);
    }

    function snapshot() public onlyOwner {
        _snapshot();
    }

    // The following functions are overrides required by Solidity.

    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        override(ERC20, ERC20Snapshot)
    {
        super._beforeTokenTransfer(from, to, amount);
    }

    /// @notice Allows the DAO to set a new contract address for Dope Wars Loot. This is
    /// relevant in the event that DWL migrates to a new contract.
    /// @param dopeWarsLootContractAddress_ The new contract address for DWL
    function daoSetLootContractAddress(address dopeWarsLootContractAddress_)
        external
        onlyOwner
    {
        dopeWarsLootContractAddress = dopeWarsLootContractAddress_;
        dopeWarsLootContract = IERC721Enumerable(dopeWarsLootContractAddress);
    }

    /// @notice Claim Paper for a given Dope Wars Loot ID
    /// @param tokenId The tokenId of the Dope Wars Loot NFT
    function claimById(uint256 tokenId) external {
        // Follow the Checks-Effects-Interactions pattern to prevent reentrancy
        // attacks

        // Checks

        // Check that the msgSender owns the token that is being claimed
        require(
            _msgSender() == dopeWarsLootContract.ownerOf(tokenId),
            "MUST_OWN_TOKEN_ID"
        );

        // Further Checks, Effects, and Interactions are contained within the
        // _claim() function
        _claim(tokenId, _msgSender());
    }

    /// @notice Claim Paper for all tokens owned by the sender
    /// @notice This function will run out of gas if you have too much loot! If
    /// this is a concern, you should use claimRangeForOwner and claim Dope in
    /// batches.
    function claimAllForOwner() external {
        uint256 tokenBalanceOwner = dopeWarsLootContract.balanceOf(_msgSender());

        // Checks
        require(tokenBalanceOwner > 0, "NO_TOKENS_OWNED");

        // i < tokenBalanceOwner because tokenBalanceOwner is 1-indexed
        for (uint256 i = 0; i < tokenBalanceOwner; i++) {
            // Further Checks, Effects, and Interactions are contained within
            // the _claim() function
            _claim(
                dopeWarsLootContract.tokenOfOwnerByIndex(_msgSender(), i),
                _msgSender()
            );
        }
    }

    /// @notice Claim Paper for all tokens owned by the sender within a
    /// given range
    /// @notice This function is useful if you own too much DWL to claim all at
    /// once or if you want to leave some Paper unclaimed. If you leave Paper
    /// unclaimed, however, you cannot claim it once the next season starts.
    function claimRangeForOwner(uint256 ownerIndexStart, uint256 ownerIndexEnd)
        external
    {
        uint256 tokenBalanceOwner = dopeWarsLootContract.balanceOf(_msgSender());

        // Checks
        require(tokenBalanceOwner > 0, "NO_TOKENS_OWNED");

        // We use < for ownerIndexEnd and tokenBalanceOwner because
        // tokenOfOwnerByIndex is 0-indexed while the token balance is 1-indexed
        require(
            ownerIndexStart >= 0 && ownerIndexEnd < tokenBalanceOwner,
            "INDEX_OUT_OF_RANGE"
        );

        // i <= ownerIndexEnd because ownerIndexEnd is 0-indexed
        for (uint256 i = ownerIndexStart; i <= ownerIndexEnd; i++) {
            // Further Checks, Effects, and Interactions are contained within
            // the _claim() function
            _claim(
                dopeWarsLootContract.tokenOfOwnerByIndex(_msgSender(), i),
                _msgSender()
            );
        }
    }

    /// @dev Internal function to mint Paper upon claiming
    function _claim(uint256 tokenId, address tokenOwner) internal {
        // Checks
        // Check that the token ID is in range
        // We use >= and <= to here because all of the token IDs are 0-indexed
        require(
            tokenId >= tokenIdStart && tokenId <= tokenIdEnd,
            "TOKEN_ID_OUT_OF_RANGE"
        );

        // Check that Paper have not already been claimed this season
        // for a given tokenId
        require(
            !claimedByTokenId[tokenId],
            "PAPER_CLAIMED_FOR_TOKEN_ID"
        );

        // Effects

        // Mark that Paper has been claimed for the
        // given tokenId
        claimedByTokenId[tokenId] = true;

        // Interactions

        // Send Paper to the owner of the token ID
        _mint(tokenOwner, paperPerTokenId);
    }
}
