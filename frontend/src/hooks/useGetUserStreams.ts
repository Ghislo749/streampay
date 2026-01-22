// hooks/useUserStreams.ts

// ============================================================================
// PRODUCTION SCALABILITY NOTE
// ============================================================================
// 
// CURRENT APPROACH (Client-side iteration):
// - Fetches all streams from contract and filters client-side
// - Works well for MVP and testing (< 1000 streams)
// - Performance degrades with thousands of streams
//
// RECOMMENDED FOR PRODUCTION/MAINNET:
// 
// 1. EVENT INDEXING SERVICE
//    - Deploy a backend service (Node.js, Python, etc.)
//    - Listen to contract events using Stacks blockchain API
//    - Index events: create-stream, cancel-stream, pause-stream, etc.
//    - Store in database (PostgreSQL, MongoDB) with indexed queries
//    - Example: https://docs.hiro.so/stacks.js/guides/how-to-listen-events
//
// 2. GRAPHQL API (Optional)
//    - Build GraphQL layer over indexed data
//    - Enables complex queries: getUserStreams(address, filters)
//    - Supports pagination, sorting, real-time subscriptions
//
// 3. CACHING LAYER
//    - Redis/Memcached for frequently accessed data
//    - Reduces RPC calls and improves UX
//
// ALTERNATIVES:
// - Use existing indexers: Hiro API, Stacks.js chainhook
// - Third-party services: The Graph Protocol (if supported)
// - Subgraph for Stacks (community solutions)
//
// MIGRATION PATH:
// - Add backend API endpoints: GET /api/streams/:address
// - Update this hook to fetch from API instead of RPC
// - Keep contract events for reliable data source
// - Add WebSocket for real-time updates
//
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { fetchCallReadOnlyFunction, cvToValue, Cl } from '@stacks/transactions';
import { NETWORK, CONTRACT_ADDRESS, STREAMING_CONTRACT_NAME } from '@/utils/contract';

export interface Stream {
    id: number;
    sender: string;
    recipient: string;
    token: string;
    rate: bigint;
    deposit: bigint;
    interval: number;
    withdrawn: bigint;
    owed: bigint;
    isPaused: boolean;
    type: 'incoming' | 'outgoing';
}

export function useUserStreams(walletAddress: string | null) {
    const [streams, setStreams] = useState<Stream[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

    const fetchUserStreams = useCallback(async () => {
        if (!walletAddress) {
            setStreams([]);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Get total stream counter
            const counterResult = await fetchCallReadOnlyFunction({
                contractAddress: CONTRACT_ADDRESS,
                contractName: STREAMING_CONTRACT_NAME,
                functionName: 'get-stream-counter',
                functionArgs: [],
                network: NETWORK,
                senderAddress: CONTRACT_ADDRESS,
            });

            const counter = cvToValue(counterResult);
            const totalStreams = Number(counter.value);

            console.log(`📊 Total streams in contract: ${totalStreams}`);

            if (totalStreams === 0) {
                setStreams([]);
                setLastRefresh(new Date());
                setLoading(false);
                return;
            }

            // Fetch streams in parallel batches of 20 for better performance
            const BATCH_SIZE = 20;
            const userStreams: Stream[] = [];

            for (let batchStart = 1; batchStart <= totalStreams; batchStart += BATCH_SIZE) {
                const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, totalStreams);
                const batchPromises = [];

                for (let i = batchStart; i <= batchEnd; i++) {
                    batchPromises.push(
                        fetchCallReadOnlyFunction({
                            contractAddress: CONTRACT_ADDRESS,
                            contractName: STREAMING_CONTRACT_NAME,
                            functionName: 'get-stream-stats',
                            functionArgs: [Cl.uint(i)],
                            network: NETWORK,
                            senderAddress: CONTRACT_ADDRESS,
                        }).catch((err) => {
                            console.log(`Stream ${i} fetch failed:`, err.message);
                            return null;
                        })
                    );
                }

                const batchResults = await Promise.all(batchPromises);

                // Process batch results
                batchResults.forEach((result, index) => {
                    if (!result) return;

                    try {
                        const streamData = cvToValue(result);
                        const streamId = batchStart + index;

                        console.log(`🔍 Stream ${streamId} raw data:`, streamData.value);

                        if (streamData.value) {
                            const stream = streamData.value;

                            console.log(`🔍 Stream ${streamId} sender:`, stream.sender.value);
                            console.log(`🔍 Stream ${streamId} recipient:`, stream.recipient.value);
                            console.log(`🔍 Current wallet:`, walletAddress);
                            console.log(`🔍 Sender match:`, stream.sender.value === walletAddress);
                            console.log(`🔍 Recipient match:`, stream.recipient.value === walletAddress);

                            // Only include streams where user is sender OR recipient
                            if (stream.sender.value === walletAddress || stream.recipient.value === walletAddress) {
                                console.log(`✅ Adding stream ${streamId} to user streams`);

                                userStreams.push({
                                    id: streamId,
                                    sender: stream.sender.value,
                                    recipient: stream.recipient.value,
                                    token: stream.token.value,
                                    rate: BigInt(stream.rate.value),
                                    deposit: BigInt(stream.deposit.value),
                                    interval: Number(stream.interval.value || 1),
                                    withdrawn: BigInt(stream.withdrawn.value),
                                    owed: BigInt(stream.owed.value),
                                    isPaused: stream['is-paused'].value || false,
                                    type: stream.recipient.value === walletAddress ? 'incoming' : 'outgoing',
                                });
                            } else {
                                console.log(`❌ Stream ${streamId} does not match user`);
                            }
                        }
                    } catch (e) {
                        console.log(`❌ Error parsing stream ${batchStart + index}:`, e);
                    }
                });
            }

            console.log(`✅ Found ${userStreams.length} streams for user`);
            setStreams(userStreams);
            setLastRefresh(new Date());
        } catch (e: any) {
            setError(e.message || 'Failed to fetch streams');
            console.error('❌ Error fetching user streams:', e);
        } finally {
            setLoading(false);
        }
    }, [walletAddress]);

    useEffect(() => {
        fetchUserStreams();

        // Auto-refresh every 30 seconds
        const interval = setInterval(fetchUserStreams, 30000);

        return () => clearInterval(interval);
    }, [fetchUserStreams]);

    // Expose refresh function and last refresh time
    return { streams, loading, error, lastRefresh, refresh: fetchUserStreams };
}

// Calculate aggregate stats
export function calculateStreamStats(streams: Stream[], walletAddress: string | null) {
    if (!walletAddress) {
        return {
            activeCount: 0,
            incomingCount: 0,
            outgoingCount: 0,
            totalStreamed: BigInt(0),
            availableToWithdraw: BigInt(0),
        };
    }

    const activeStreams = streams.filter(s => !s.isPaused);
    const incomingStreams = activeStreams.filter(s => s.type === 'incoming');
    const outgoingStreams = activeStreams.filter(s => s.type === 'outgoing');

    const totalStreamed = streams.reduce((acc, stream) => acc + stream.withdrawn, BigInt(0));
    const availableToWithdraw = incomingStreams.reduce((acc, stream) => acc + stream.owed, BigInt(0));

    return {
        activeCount: activeStreams.length,
        incomingCount: incomingStreams.length,
        outgoingCount: outgoingStreams.length,
        totalStreamed,
        availableToWithdraw,
    };
}