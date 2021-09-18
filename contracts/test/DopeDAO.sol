// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/governance/Governor.sol";
import "@openzeppelin/contracts/governance/compatibility/GovernorCompatibilityBravo.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotesComp.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorTimelockCompound.sol";

import "../governance/DopeDAO.sol";

contract DopeDAOTest is DopeDAO {
    constructor(ERC20VotesComp _token, ICompoundTimelock _timelock) DopeDAO(_token, _timelock) {}

    function votingDelay() public pure override returns (uint256) {
        return 1;
    }

    function votingPeriod() public pure override returns (uint256) {
        return 2;
    }

    function quorum(uint256 blockNumber) public pure override returns (uint256) {
        return 1;
    }

    function proposalThreshold() public pure override returns (uint256) {
        return 1;
    }
}
