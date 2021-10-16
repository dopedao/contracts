import hre, { ethers } from "hardhat"

import { DopeWarsLoot__factory, DopeDAO__factory, ICompoundTimelock__factory, Receiver, Receiver__factory } from "../typechain"

const { parseUnits } = ethers.utils

const LOOT = "0x8707276df042e89669d69a177d3da7dc78bd8723"
const DAO = "0xDBd38F7e739709fe5bFaE6cc8eF67C3820830E0C"
const TIMELOCK = "0xb57ab8767cae33be61ff15167134861865f7d22c"

const MS = "0xB429Bee46B7DF01D759D04D57DaBe814ECf0341b"

const proposalMarkdown = `
# DIP-6: Pixel Art + DIP-4 Part 1 + DIP-5 Gas Refunds

A batch proposal for:

[Commission Dope Wars Pixel Art](https://snapshot.org/#/dopedao.eth/proposal/Qmbhdyn31sMSu2LgFwj36747jcYbhbQWXTA8tuEv9e2NK3)
**10**eth to \`0xc2407b34b19d2227addc5c6eae5c5d99432a0c99\` 

[DIP-4: RYO v1](https://snapshot.org/#/dopedao.eth/proposal/QmZmidDFYbvS5L7EqmL8RsqXTZ9t1yZc3MpYSwMTfJLLwY)
First installment of **2.5**eth to \`0xa2701f1dadae0e1ee9fa68ab90abbda61cd9e06b\`

[DIP-5: Development Gas Refund](https://www.notion.so/DIP-5-Development-Gas-Refund-a6b7e43af34e4a7682ac06a4bbe7c99d)
Gas refunds for contract deployments.
**2.6572230788**eth to \`0xe8d848debb3a3e12aa815b15900c8e020b863f31\`
**1.15785465171**eth to \`0xba740c9035fF3c24A69e0df231149c9cd12BAe07\`
`

const mrfax = "0xc2407b34b19d2227addc5c6eae5c5d99432a0c99";
const mrfaxPayout = parseUnits("10.0", "ether")
const perama = "0xa2701f1dadae0e1ee9fa68ab90abbda61cd9e06b";
const peramaPayout = parseUnits("2.5", "ether")
const dennison = "0xe8d848debb3a3e12aa815b15900c8e020b863f31";
const dennisonPayout = parseUnits("2.6572230788", "ether")
const tarrence = "0xba740c9035fF3c24A69e0df231149c9cd12BAe07";
const tarrencePayout = parseUnits("1.15785465171", "ether")

const faces = "0xa2de2d19edb4094c79fb1a285f3c30c77931bf1e";
const wolf = "0x45ba4bf71371070803bdf2c8b89e4b3eede65d99";
const shecky = "0xa9da2e4b36d75d3aee8630c6acd09fd567091f10";

async function main() {
    const signers = await ethers.getSigners()

    const loot = DopeWarsLoot__factory.connect(LOOT, signers[0])
    const dao = DopeDAO__factory.connect(DAO, signers[0])
    const timelock = ICompoundTimelock__factory.connect(TIMELOCK, signers[0])

    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: ["0xba740c9035fF3c24A69e0df231149c9cd12BAe07"],
    });

    const proposer = await ethers.provider.getSigner(
        tarrence
    );

    let txn = await dao.connect(proposer)["propose(address[],uint256[],string[],bytes[],string)"](
        [mrfax, perama, dennison, tarrence],
        [mrfaxPayout, peramaPayout, dennisonPayout, tarrencePayout],
        [], ["0x", "0x", "0x", "0x"], proposalMarkdown)

    const receipt = await txn.wait()
    const proposalId = receipt.events![0].args!.proposalId

    const delay = await dao.votingDelay()

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

    for (let address of [faces, wolf, shecky]) {
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [address],
        });

        const voter = await ethers.provider.getSigner(address);
        await dao.connect(voter).castVote(proposalId, 1)
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
    let now = latest.timestamp
    await hre.network.provider.request({
        method: "evm_setNextBlockTimestamp",
        params: [now + (await timelock.delay()).toNumber() + 1],
    });

    proposal = await dao.proposals(proposalId)
    const state = await dao.state(proposalId)

    const tarrenceBefore = await ethers.provider.getBalance(tarrence)

    console.log("Executing proposal with status:", state)
    await dao["execute(uint256)"](proposalId, {
        gasLimit: 500000,
    })

    const tarrenceAfter = await ethers.provider.getBalance(tarrence)

    console.log(tarrenceBefore.toString(), tarrenceAfter.toString())
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });