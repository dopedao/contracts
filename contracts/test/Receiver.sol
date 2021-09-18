pragma solidity ^0.8.2;

contract Receiver {
    function receiveEth(string calldata) public payable {}

    function receiveNoEth(string calldata) public {}
}
