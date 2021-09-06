import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { Fixture } from "ethereum-waffle";

import { MockERC20, MockERC721, NftStake } from "../typechain";
declare module "mocha" {
  export interface Context {
    nftStake: NftStake;
    mockERC20: MockERC20;
    mockERC721: MockERC721;
    emission: number;
    loadFixture: <T>(fixture: Fixture<T>) => Promise<T>;
    signers: Signers;
  }
}

export interface Signers {
  admin: SignerWithAddress;
  alice: SignerWithAddress;
  bob: SignerWithAddress;
  dao: SignerWithAddress;
}
