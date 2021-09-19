import hre, { ethers } from "hardhat"

import { DopeWarsLoot__factory, DopeDAO__factory, ICompoundTimelock__factory, Receiver, Receiver__factory } from "../typechain"

const LOOT = "0x8707276df042e89669d69a177d3da7dc78bd8723"
const DAO = "0xDBd38F7e739709fe5bFaE6cc8eF67C3820830E0C"
const TIMELOCK = "0xb57ab8767cae33be61ff15167134861865f7d22c"

const MS = "0xB429Bee46B7DF01D759D04D57DaBe814ECf0341b"

async function main() {
    const signers = await ethers.getSigners()

    const receiverFactory: Receiver__factory = await ethers.getContractFactory("Receiver");
    const receiver: Receiver = <Receiver>(await receiverFactory.deploy());
    await receiver.deployed();

    console.log("Receiver at ", receiver.address)

    const loot = DopeWarsLoot__factory.connect(LOOT, signers[0])
    const dao = DopeDAO__factory.connect(DAO, signers[0])
    const timelock = ICompoundTimelock__factory.connect(TIMELOCK, signers[0])

    await signers[0].sendTransaction({
        to: MS,
        value: ethers.utils.parseEther("1.0")
    });

    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: ["0xB429Bee46B7DF01D759D04D57DaBe814ECf0341b"],
    });

    const ms = await ethers.provider.getSigner(
        "0xB429Bee46B7DF01D759D04D57DaBe814ECf0341b"
    );

    let { timestamp: now } = await hre.waffle.provider.getBlock('latest')
    let eta = now + (await timelock.delay()).toNumber() + 1
    console.log("Queue pending admin to dao")
    await timelock.connect(ms).queueTransaction(timelock.address, 0, "setPendingAdmin(address)", "0x000000000000000000000000dbd38f7e739709fe5bfae6cc8ef67c3820830e0c", eta)

    await hre.network.provider.request({
        method: "evm_setNextBlockTimestamp",
        params: [eta],
    });

    console.log("Execute pending admin to dao")
    await timelock.connect(ms).executeTransaction(timelock.address, 0, "setPendingAdmin(address)", "0x000000000000000000000000dbd38f7e739709fe5bfae6cc8ef67c3820830e0c", eta)

    await dao.__acceptAdmin()
    const admin = await timelock.admin()

    if (admin != dao.address) {
        throw new Error("dao not timelock admin")
    }

    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: ["0xba740c9035fF3c24A69e0df231149c9cd12BAe07"],
    });

    const proposer = await ethers.provider.getSigner(
        "0xba740c9035fF3c24A69e0df231149c9cd12BAe07"
    );

    const sig = "receiveEth(string)"
    const calldata = new ethers.utils.AbiCoder().encode(["string"], ["gang"]);
    const treasury = await ethers.provider.getBalance(timelock.address)
    let txn = await dao.connect(proposer)["propose(address[],uint256[],string[],bytes[],string)"](
        [receiver.address], [treasury], [sig], [calldata], "send funds")

    console.log(`Proposing to send ${treasury} to receiver.`)
    const receipt = await txn.wait()
    const proposalId = receipt.events![0].args!.proposalId

    const delay = await dao.votingDelay()
    const quorum = (await dao.quorumVotes()).toNumber()

    for (var i = 0; i < delay.toNumber(); i++) {
        hre.network.provider.send("evm_mine");
    }

    await dao.connect(proposer).castVote(proposalId, 1)

    if (!(await dao.hasVoted(proposalId, proposer._address))) {
        throw new Error("proposer has voted")
    }

    let proposal = await dao.proposals(proposalId)

    if (proposal.forVotes.eq(await loot.balanceOf(proposer._address))) {
        throw new Error("proposer votes not counted for")
    }

    const voted: { [key: string]: boolean } = {}
    for (var i = 1; i < quorum + 1; i++) {
        const owner = await loot.ownerOf(i)
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [owner],
        });

        if (voted[owner]) {
            continue
        }

        const balance = await ethers.provider.getBalance(owner);
        if (balance.eq(0)) {
            continue
        }

        const voter = await ethers.provider.getSigner(owner);
        await dao.connect(voter).castVote(proposalId, 1)
        voted[owner] = true
    }

    proposal = await dao.proposals(proposalId)

    console.log(`Voted, proposal has ${proposal.forVotes} votes for.`)

    try {
        await dao["queue(uint256)"](proposalId)
        throw new Error("Queueing proposal early should fail")
    } catch { }

    const block = parseInt(await hre.network.provider.send("eth_blockNumber"), 16);
    const toEnd = proposal.endBlock.toNumber() - block

    console.log(`Incrementing ${toEnd} blocks.`)
    for (var i = 0; i < toEnd; i++) {
        await hre.network.provider.send("evm_mine");
    }

    console.log("Queueing proposal")
    await dao["queue(uint256)"](proposalId)

    try {
        await dao["execute(uint256)"](proposalId)
        throw new Error("Executing proposal early should fail")
    } catch { }

    let latest = await hre.waffle.provider.getBlock('latest')
    now = latest.timestamp
    await hre.network.provider.request({
        method: "evm_setNextBlockTimestamp",
        params: [now + (await timelock.delay()).toNumber() + 1],
    });

    proposal = await dao.proposals(proposalId)
    const state = await dao.state(proposalId)

    console.log("Executing proposal with status:", state)
    await dao["execute(uint256)"](proposalId, {
        gasLimit: 500000,
    })

    const balance = await ethers.provider.getBalance(receiver.address)

    console.log(treasury.toString(), balance.toString())

    if (!treasury.eq(balance)) {
        throw new Error("incorrect final balance")
    }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });