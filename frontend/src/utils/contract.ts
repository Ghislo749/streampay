import { request } from '@stacks/connect';
import { TransactionResult } from '@stacks/connect/dist/types/methods';
import type { ClarityValue } from '@stacks/connect/dist/types/methods'
import { Cl, Pc, fetchCallReadOnlyFunction, cvToValue } from '@stacks/transactions'

export const NETWORK = 'testnet';
export const CONTRACT_ADDRESS = 'ST30J9EZKY44SS1EBT8XNKJFA77Z4TSDBEMZ55MEJ';
export const STREAMING_CONTRACT_NAME = 'precious-white-sparrow';
export const TOKEN_CONTRACT_NAME = 'charming-amethyst-pinniped';

export const STREAMING_CONTRACT = `${CONTRACT_ADDRESS}.${STREAMING_CONTRACT_NAME}`;
export const USDCX_CONTRACT = `${CONTRACT_ADDRESS}.${TOKEN_CONTRACT_NAME}`;

//  USDC Mainnet SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx
//  USDC Testnet ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx
//  USDC Testnet Mock ST30J9EZKY44SS1EBT8XNKJFA77Z4TSDBEMZ55MEJ.charming-amethyst-pinniped
//  StreamPay Testnet ST30J9EZKY44SS1EBT8XNKJFA77Z4TSDBEMZ55MEJ.precious-white-sparrow
//  StreamPay Mainnet 

// Create new stream
export async function createStream(
    sender: string,
    recipient: string,
    ratePerBlock: bigint,
    depositAmount: bigint,
    interval: bigint) {

    let pc1 = Pc.principal(sender).willSendEq(depositAmount).ft(USDCX_CONTRACT, 'usdcx-token')

    const functionArgs = [
        Cl.principal(recipient),
        Cl.uint(ratePerBlock),
        Cl.uint(depositAmount),
        Cl.uint(interval),
        Cl.contractPrincipal(CONTRACT_ADDRESS, TOKEN_CONTRACT_NAME)
    ];

    let result: TransactionResult = await request('stx_callContract', {
        contract: STREAMING_CONTRACT,
        functionName: 'create-stream',
        functionArgs,
        network: NETWORK,
        postConditions: [pc1],
        postConditionMode: 'deny',
        sponsored: false
    })

    console.log(result)
}

// Stream recipient withdrawal function
export async function withdraw(streamId: number) {

    let pc1 = Pc.principal(STREAMING_CONTRACT).willSendGt(0).ft(USDCX_CONTRACT, 'usdcx-token')

    const functionArgs = [
        Cl.uint(streamId),
        Cl.contractPrincipal(CONTRACT_ADDRESS, TOKEN_CONTRACT_NAME)
    ];

    let result: TransactionResult = await request('stx_callContract', {
        contract: STREAMING_CONTRACT,
        functionName: 'withdraw-from-stream',
        functionArgs,
        network: NETWORK,
        postConditions: [pc1],
        postConditionMode: 'deny',
        sponsored: false
    })

    console.log(result)
}

// Pause a stream (sender only)
export async function pauseStream(streamId: number) {
    
    let pc1 = Pc.principal(STREAMING_CONTRACT).willSendGte(0).ft(USDCX_CONTRACT, 'usdcx-token')

    const functionArgs = [
        Cl.uint(streamId),
        Cl.contractPrincipal(CONTRACT_ADDRESS, TOKEN_CONTRACT_NAME)
    ];

    let result: TransactionResult = await request('stx_callContract', {
        contract: STREAMING_CONTRACT,
        functionName: 'pause-stream',
        functionArgs,
        network: NETWORK,
        postConditions: [pc1],
        postConditionMode: 'deny',
        sponsored: false
    })

    console.log(result)
}

// Resume a paused stream (sender only)
export async function resumeStream(streamId: number) {

    const functionArgs = [
        Cl.uint(streamId)
    ];

    let result: TransactionResult = await request('stx_callContract', {
        contract: STREAMING_CONTRACT,
        functionName: 'resume-stream',
        functionArgs,
        network: NETWORK,
        postConditionMode: 'deny',
        sponsored: false
    })

    console.log(result)
}

// Top-up an existing stream with additional funds (sender only)
export async function topUpStream(sender: string, streamId: number, additionalAmount: bigint) {

    let pc1 = Pc.principal(sender).willSendEq(additionalAmount).ft(USDCX_CONTRACT, 'usdcx-token')

    const functionArgs = [
        Cl.uint(streamId),
        Cl.uint(additionalAmount),
        Cl.contractPrincipal(CONTRACT_ADDRESS, TOKEN_CONTRACT_NAME)
    ];

    let result: TransactionResult = await request('stx_callContract', {
        contract: STREAMING_CONTRACT,
        functionName: 'top-up-stream',
        functionArgs,
        network: NETWORK,
        postConditions: [pc1],
        postConditionMode: 'deny',
        sponsored: false
    })

    console.log(result)
}

// Cancel a stream and settle final payment (sender only)
export async function cancelStream(streamId: number) {

    let pc1 = Pc.principal(STREAMING_CONTRACT).willSendGte(0).ft(USDCX_CONTRACT, 'usdcx-token')

    const functionArgs = [
        Cl.uint(streamId),
        Cl.contractPrincipal(CONTRACT_ADDRESS, TOKEN_CONTRACT_NAME)
    ];

    let result: TransactionResult = await request('stx_callContract', {
        contract: STREAMING_CONTRACT,
        functionName: 'cancel-stream',
        functionArgs,
        network: NETWORK,
        postConditions: [pc1],
        postConditionMode: 'deny',
        sponsored: false
    })

    console.log(result)
}

// USDCx has 6 decimals
export const USDCX_DECIMALS = 6;

// Convert USDCx to micro-USDCx
export function toMicroUSDCx(usdcx: number): bigint {
    return BigInt(Math.floor(usdcx * Math.pow(10, USDCX_DECIMALS)));
}

// Convert micro-USDCx to USDCx
export function fromMicroUSDCx(microUsdcx: bigint): number {
    return Number(microUsdcx) / Math.pow(10, USDCX_DECIMALS);
}

// Get usdcx balance
export async function getUsdcxBalance(address: string) {

    if (address === null) return;

    const [address_id, name] = USDCX_CONTRACT.split('.');
    let result: ClarityValue = await fetchCallReadOnlyFunction({
        contractAddress: address_id,
        contractName: name,
        functionName: 'get-balance',
        functionArgs: [Cl.principal(address)],
        network: NETWORK,
        senderAddress: address_id,
    })

    const value = cvToValue(result, true);
    return value || 0;
}


// faucet remove in prod
export async function mintTestTokens() {
    await request('stx_callContract', {
        contract: USDCX_CONTRACT,
        functionName: 'faucet',
        functionArgs: [],
        network: NETWORK,
        postConditionMode: 'allow',
    });
}