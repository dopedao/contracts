import hre, { ethers } from "hardhat";
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
        it("propose and execute a proposal", async function () {
            const lootArtifact: Artifact = await hre.artifacts.readArtifact("DopeWarsLoot");
            const loot = <DopeWarsLoot>await deployContract(this.signers.admin, lootArtifact, []);

            const timelockArtifact: Artifact = await hre.artifacts.readArtifact("Timelock");
            const timelock = <Timelock>await deployContract(this.signers.admin, timelockArtifact, [this.signers.admin.address, 60]);

            const daoArtifact: Artifact = await hre.artifacts.readArtifact("DopeDAOTest");
            const dao = <DopeDAOTest>await deployContract(this.signers.admin, daoArtifact, [loot.address, timelock.address]);

            const receiverArtifact: Artifact = await hre.artifacts.readArtifact("Receiver");
            const receiver = <Receiver>await deployContract(this.signers.admin, receiverArtifact, []);

            await Promise.all([...Array(5).keys()].map(async (i) => loot.claim(i + 1)))
            await this.signers.alice.sendTransaction({
                to: timelock.address,
                value: ethers.utils.parseEther("1.0")
            })

            const eta = Date.now() + 10;
            const sig = "setPendingAdmin(address)"
            const data = new ethers.utils.AbiCoder().encode(["address"], [dao.address]);
            await timelock.queueTransaction(timelock.address, 0, sig, data, eta)

            await hre.network.provider.request({
                method: "evm_setNextBlockTimestamp",
                params: [eta],
            });

            await timelock.executeTransaction(timelock.address, 0, sig, data, eta)
            await dao.__acceptAdmin()

            console.log((await ethers.provider.getBalance(timelock.address)).toString())

            const calldata = new ethers.utils.AbiCoder().encode(["string"], ["gang"]);
            let txn = await dao["propose(address[],uint256[],string[],bytes[],string)"](
                [receiver.address], [ethers.utils.parseEther("0.1")], ["receiveETH(string)"], [calldata], "send funds"
            )
            const receipt = await txn.wait()
            const proposalId = receipt.events![0].args!.proposalId

            hre.network.provider.send("evm_mine");

            await dao.castVote(proposalId, 1)
            await dao["queue(uint256)"](proposalId)

            await hre.network.provider.request({
                method: "evm_setNextBlockTimestamp",
                params: [Date.now() + 1],
            });

            await dao["execute(uint256)"](proposalId)
        })
    })
})