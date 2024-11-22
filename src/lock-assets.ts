// Dependencies / modules yang digunakan
import {
  BlockfrostProvider,
  MeshWallet,
  Asset,
  deserializeAddress,
  serializePlutusScript,
  mConStr0,
  MeshTxBuilder,
} from "@meshsdk/core";
import { applyParamsToScript } from "@meshsdk/core-csl";
import dotenv from "dotenv";
dotenv.config();

// Menentukan jumlah asset yang akan di depositkan atau dikunci, satuan dalam Lovelace
const quantity = "177000000";

// Integrasi smart-contract
import contractBlueprint from "../aiken-workspace/plutus.json";

// Loading environment variable blockfrost API key dan seedphrares wallet
const blockfrostApiKey = process.env.BLOCKFROST_API_KEY || "";
const mnemonic = process.env.MNEMONIC
  ? process.env.MNEMONIC.split(",")
  : "solution,".repeat(24).split(",").slice(0, 24);

// Inisiasi node provider Blockfrost
const nodeProvider = new BlockfrostProvider(blockfrostApiKey);

// Inisiasi Cardano Wallet
const wallet = new MeshWallet({
  networkId: 0, // Testnet preview or preprod
  fetcher: nodeProvider,
  submitter: nodeProvider,
  key: {
    type: "mnemonic",
    words: mnemonic,
  },
});

// Mendapatkan kontrak address
const { scriptAddr } = getScript(contractBlueprint.validators[0].compiledCode);

// Mendapatkan index utxo dan alamat wallet
const { utxos, walletAddress } = await getWalletInfo();

// Mendapatkan pub key hash sebagai persetujuan user untuk menandatangi transaksi
const signerHash = deserializeAddress(walletAddress).pubKeyHash;

// Menentukan jumlah aset yang akan di kunci
const assets: Asset[] = [{ unit: "lovelace", quantity: quantity }];

// Membuat draft transaksi
const txBuild = new MeshTxBuilder({
  fetcher: nodeProvider,
  evaluator: nodeProvider,
  verbose: true,
});
const txDraft = await txBuild
  .setNetwork("preprod")
  .txOut(scriptAddr, assets)
  .txOutDatumHashValue(mConStr0([signerHash]))
  .changeAddress(walletAddress)
  .selectUtxosFrom(utxos)
  .complete();

// Menandatangani transaksi
const signedTx = await wallet.signTx(txDraft);

// Submit transaksi dan mendapatkan transaksi hash
const txHash = await wallet.submitTx(signedTx);
console.log("TxHash :", txHash);

// Fungsi membaca contract address
function getScript(
  blueprintCompiledCode: string,
  params: string[] = [],
  version: "V1" | "V2" | "V3" = "V3"
) {
  const scriptCbor = applyParamsToScript(blueprintCompiledCode, params);
  const scriptAddr = serializePlutusScript(
    { code: scriptCbor, version: version },
    undefined,
    0
  ).address;

  return { scriptCbor, scriptAddr };
}

// Fungsi membaca informasi wallet
async function getWalletInfo() {
  const utxos = await wallet.getUtxos();
  const collateral = (await wallet.getCollateral())[0];
  const walletAddress = await wallet.getChangeAddress();

  if (!utxos || utxos?.length === 0) {
    throw new Error("No utxos found");
  }
  if (!collateral) {
    throw new Error("No collateral found");
  }
  if (!walletAddress) {
    throw new Error("No wallet address found");
  }

  return { utxos, collateral, walletAddress };
}
