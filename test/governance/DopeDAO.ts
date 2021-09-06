import hre, { ethers } from "hardhat";
import { expect } from "chai";

import { Artifact } from "hardhat/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import { Signers } from "../types";
import { DopeWarsLoot, DopeDAOTest, Receiver, Timelock } from "../../typechain";

const { deployContract } = hre.waffle;

describe("DopeDAO", function () {
    before(async function () {
        this.signers = {} as Signers;

        const signers: SignerWithAddress[] = await hre.ethers.getSigners();
        this.signers.admin = signers[0];
        this.signers.alice = signers[1];
        this.signers.bob = signers[2];
    });

    describe("lifecycle", function () {
        beforeEach(async function () {
            const lootArtifact: Artifact = await hre.artifacts.readArtifact("DopeWarsLoot");
            this.loot = <DopeWarsLoot>await deployContract(this.signers.admin, lootArtifact, []);

            const timelockArtifact: Artifact = await hre.artifacts.readArtifact("Timelock");
            this.timelock = <Timelock>await deployContract(this.signers.admin, timelockArtifact, [this.signers.admin.address, 10]);

            const daoArtifact: Artifact = await hre.artifacts.readArtifact("DopeDAOTest");
            this.dao = <DopeDAOTest>await deployContract(this.signers.admin, daoArtifact, [this.loot.address, this.timelock.address]);

            const receiverArtifact: Artifact = await hre.artifacts.readArtifact("Receiver");
            this.receiver = <Receiver>await deployContract(this.signers.admin, receiverArtifact, []);

            await Promise.all([...Array(5).keys()].map(async (i) => this.loot.claim(i + 1)))
        });

        it("propose and execute a proposal with no eth", async function () {
            let now = await hre.waffle.provider.getBlock('latest').then(block => block.timestamp)
            const eta = now + 11;
            const sig = "setPendingAdmin(address)"
            const data = new ethers.utils.AbiCoder().encode(["address"], [this.dao.address]);

            await this.timelock.queueTransaction(this.timelock.address, 0, sig, data, eta);

            await hre.network.provider.request({
                method: "evm_setNextBlockTimestamp",
                params: [eta],
            });

            await this.timelock.executeTransaction(this.timelock.address, 0, sig, data, eta);
            await this.dao.__acceptAdmin()

            const calldata = new ethers.utils.AbiCoder().encode(["string"], ["gang"]);

            const txn = await this.dao["propose(address[],uint256[],string[],bytes[],string)"](
                [this.receiver.address], [0], ["receiveNoEth(string)"], [calldata], "Send no ETH"
            )

            const receipt = await txn.wait()
            const proposalId = receipt.events![0].args!.proposalId

            // check proposal id exists
            expect((await this.dao.proposals(proposalId)).forVotes.toString()).to.eql("0")

            await hre.network.provider.send("evm_mine");

            await this.dao.castVote(proposalId, 1);

            // check we have voted
            expect((await this.dao.proposals(proposalId)).forVotes.toString()).to.eql("5")

            await this.dao["queue(uint256)"](proposalId);

            now = await hre.waffle.provider.getBlock('latest').then(block => block.timestamp)
            await hre.network.provider.request({
                method: "evm_setNextBlockTimestamp",
                params: [now + 11],
            });

            await this.dao["execute(uint256)"](proposalId)

            // check it executed
            expect((await this.dao.proposals(proposalId)).executed).to.eql(true);
        })

        it("propose and execute a proposal with eth", async function () {
            let now = await hre.waffle.provider.getBlock('latest').then(block => block.timestamp)
            const eta = now + 12;
            const sig = "setPendingAdmin(address)"
            const data = new ethers.utils.AbiCoder().encode(["address"], [this.dao.address]);

            const value = ethers.utils.parseEther("0.1")
            // send eth to the timelock
            await this.signers.alice.sendTransaction({
                to: this.timelock.address,
                value
            })

            await this.timelock.queueTransaction(this.timelock.address, 0, sig, data, eta)

            await hre.network.provider.request({
                method: "evm_setNextBlockTimestamp",
                params: [eta],
            });

            await this.timelock.executeTransaction(this.timelock.address, 0, sig, data, eta)
            await this.dao.__acceptAdmin()

            const calldata = new ethers.utils.AbiCoder().encode(["string"], ["gang"]);

            const txn = await this.dao["propose(address[],uint256[],string[],bytes[],string)"](
                [this.receiver.address], [value], ["receiveEth(string)"], [calldata], "Send ETH"
            )

            const receipt = await txn.wait()
            const proposalId = receipt.events![0].args!.proposalId

            // check proposal id exists
            expect((await this.dao.proposals(proposalId)).forVotes.toString()).to.eql("0")

            await hre.network.provider.send("evm_mine");

            await this.dao.castVote(proposalId, 1);

            // check we have voted
            expect((await this.dao.proposals(proposalId)).forVotes.toString()).to.eql("5")

            await this.dao["queue(uint256)"](proposalId);

            now = await hre.waffle.provider.getBlock('latest').then(block => block.timestamp)
            await hre.network.provider.request({
                method: "evm_setNextBlockTimestamp",
                params: [now + 11],
            });

            await this.dao["execute(uint256)"](proposalId)

            // check it executed
            expect((await this.dao.proposals(proposalId)).executed).to.eql(true);
        })
    })
})
