'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Wallet, Layers, ArrowUpRight, ArrowDownRight, X, Zap, Clock, DollarSign, Check, AlertCircle, Loader2, RefreshCw, Pause, Play, PlusCircle } from 'lucide-react';
import { connect, disconnect, isConnected, getLocalStorage } from '@stacks/connect';
import type { GetAddressesResult } from '@stacks/connect/dist/types/methods'
import { createStream, withdraw, pauseStream, resumeStream, topUpStream, cancelStream, toMicroUSDCx, fromMicroUSDCx, getUsdcxBalance, mintTestTokens } from '@/utils/contract'; // remove mint in production
import { useUserStreams, calculateStreamStats } from '@/hooks/useGetUserStreams';

// Stacks wallet connection configuration
export default function Home() {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [activeTab, setActiveTab] = useState('streams');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [bns, setBns] = useState<string>('')
  const [balance, setBalance] = useState<bigint>(BigInt(0));
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false);


  // Fetch user's streams
  const { streams, loading: streamsLoading, error: streamsError, lastRefresh, refresh: refreshStreams } = useUserStreams(address);

  // Calculate stats
  const stats = calculateStreamStats(streams, address);

  // Fetch balance function
  const fetchBalance = useCallback(async () => {
    if (!address) return;

    setIsRefreshingBalance(true);
    try {
      const bal = await getUsdcxBalance(address);
      setBalance(bal.value);
    } catch (error) {
      console.error('Error fetching balance:', error);
    } finally {
      setIsRefreshingBalance(false);
    }
  }, [address]);

  useEffect(() => {
    // Check if user is already signed in
    const initializeUser = async () => {
      if (isConnected()) {
        setIsConnecting(true)
        const userData = getLocalStorage();
        if (userData?.addresses) {
          const stxAddress = userData.addresses.stx[0].address;
          const bnsName = await getBns(stxAddress)
          setAddress(stxAddress);
          setBns(bnsName)
        }
        setIsConnecting(false)
      }
    };
    initializeUser();
  }, []);

  useEffect(() => {
    if (address) {
      fetchBalance();
    }
  }, [address, fetchBalance]);

  async function connectWallet() {
    setIsConnecting(true);

    try {
      if (isConnected()) {
        console.log('Already authenticated');
        setIsConnecting(false);
        return;
      }

      let connectionResponse: GetAddressesResult = await connect({ network: 'testnet' });
      let bnsName = await getBns(connectionResponse.addresses[2].address);

      console.log('Full addresses response:', connectionResponse.addresses);
      setAddress(connectionResponse.addresses[2].address);
      setBns(bnsName);
    } catch (error) {
      console.log('User cancelled wallet connection or error occurred:', error);
    } finally {
      setIsConnecting(false);
    }
  }

  async function getBns(stxAddress: string) {
    let response = await fetch(`https://api.bnsv2.com/names/address/${stxAddress}/valid`)
    let data = await response.json()

    console.log(data);

    return data.names[0]?.full_name || null
  }

  const disconnectWallet = () => {
    disconnect();
    window.location.reload();
  };

  // Filter streams based on active tab
  const filteredStreams = streams.filter(stream => {
    if (activeTab === 'incoming') return stream.type === 'incoming';
    if (activeTab === 'outgoing') return stream.type === 'outgoing';
    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <header className="border-b border-gray-700 bg-gray-900/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center transform rotate-45">
                  <Layers className="w-6 h-6 text-white transform -rotate-45" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-purple-500 rounded-full border-2 border-gray-900"></div>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">StreamPay</h1>
                <p className="text-xs text-gray-400">Powered by Stacks</p>
              </div>
            </div>

            {/* Wallet Connection */}
            <div className="flex items-center gap-4">
              {address ? (
                <div className="flex items-center gap-3">
                  <button
                    onClick={async () => {
                      try {
                        await mintTestTokens();
                      } catch (e) {
                        console.error('Mint error:', e);
                      }
                    }}
                    className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold rounded-lg transition-all transform hover:scale-105"
                  >
                    <Zap className="w-4 h-4" />
                    Mint Test Tokens
                  </button>
                  <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500/10 to-orange-600/10 border border-orange-500/30 rounded-lg">
                    <DollarSign className="w-4 h-4 text-orange-500" />
                    <span className="text-sm text-white font-semibold">
                      {fromMicroUSDCx(balance).toFixed(2)} USDCx
                    </span>
                    <button
                      onClick={fetchBalance}
                      disabled={isRefreshingBalance}
                      className="ml-1 p-1 hover:bg-orange-500/20 rounded transition-colors disabled:opacity-50"
                      title="Refresh balance"
                    >
                      <RefreshCw className={`w-3 h-3 text-orange-500 ${isRefreshingBalance ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-lg border border-gray-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm text-gray-300 font-mono">
                      {bns ? bns : `${address.slice(0, 6)}...${address.slice(-4)}`}
                    </span>
                  </div>
                  <button
                    onClick={disconnectWallet}
                    className="p-2 text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={connectWallet}
                  disabled={isConnecting}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold rounded-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  <Wallet className="w-5 h-5" />
                  {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!address ? (
          <WelcomeScreen connect={connectWallet} />
        ) : (
          <Dashboard
            streams={filteredStreams}
            stats={stats}
            loading={streamsLoading}
            error={streamsError}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            showCreateModal={showCreateModal}
            setShowCreateModal={setShowCreateModal}
            walletAddress={address}
            refreshStreams={refreshStreams}
            lastRefresh={lastRefresh}
          />
        )}
      </main>

      {/* Create Stream Modal */}
      {showCreateModal && (
        <CreateStreamModal
          onClose={() => setShowCreateModal(false)}
          senderAddress={address!}
          balance={balance}
        />
      )}
    </div>
  );
}

// Component: Welcome Screen
function WelcomeScreen({ connect }: { connect: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center">
      <div className="relative mb-8">
        <div className="w-24 h-24 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center transform rotate-45 shadow-2xl">
          <Zap className="w-12 h-12 text-white transform -rotate-45" />
        </div>
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-purple-500 rounded-full border-4 border-gray-900"></div>
      </div>
      <h2 className="text-4xl font-bold text-white mb-4">Welcome to StreamPay</h2>
      <p className="text-xl text-gray-400 mb-8 max-w-2xl">
        Interval-based payment streaming on Bitcoin via Stacks.
        Payments unlock at fixed intervals, withdraw anytime, settle instantly.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 max-w-4xl">
        <FeatureCard
          icon={<Clock className="w-6 h-6" />}
          title="Predictable Payments"
          description="Funds unlock at fixed intervals you choose. No surprises, no hidden math."
        />
        <FeatureCard
          icon={<DollarSign className="w-6 h-6" />}
          title="Withdraw Anytime"
          description="Access your earned funds whenever you need them."
        />
        <FeatureCard
          icon={<Check className="w-6 h-6" />}
          title="Instant Settlement"
          description="Cancel streams with automatic final settlement."
        />
      </div>
      <button
        onClick={connect}
        className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold rounded-xl text-lg transition-all transform hover:scale-105 shadow-lg"
      >
        <Wallet className="w-6 h-6" />
        Connect Wallet to Start
      </button>
    </div>
  );
}

// Component: Feature Card
function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="p-6 bg-gray-800/50 border border-gray-700 rounded-xl backdrop-blur-sm text-center">
      <div className="w-12 h-12 bg-gradient-to-br from-orange-500/20 to-orange-600/20 rounded-lg flex items-center justify-center mb-4 mx-auto">
        <span className="text-orange-500">
          {icon}
        </span>
      </div>

      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-400 text-sm">{description}</p>
    </div>
  );
}

// Component: Dashboard
function Dashboard({
  streams,
  stats,
  loading,
  error,
  activeTab,
  setActiveTab,
  showCreateModal,
  setShowCreateModal,
  walletAddress,
  refreshStreams,
  lastRefresh
}: any) {
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          label="Active Streams"
          value={stats.activeCount.toString()}
          subtext={`${stats.incomingCount} incoming • ${stats.outgoingCount} outgoing`}
          icon={<Layers className="w-5 h-5" />}
          gradient="from-orange-500 to-orange-600"
        />
        <StatCard
          label="Total Streamed"
          value={`${fromMicroUSDCx(stats.totalStreamed).toFixed(2)} USDCx`}
          subtext="Across all streams"
          icon={<ArrowUpRight className="w-5 h-5" />}
          gradient="from-purple-500 to-purple-600"
        />
        <StatCard
          label="Available to Withdraw"
          value={`${fromMicroUSDCx(stats.availableToWithdraw).toFixed(2)} USDCx`}
          subtext="From incoming streams"
          icon={<DollarSign className="w-5 h-5" />}
          gradient="from-green-500 to-green-600"
        />
      </div>

      {/* Tabs & Create Button */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2 bg-gray-800 rounded-lg p-1">
          <TabButton active={activeTab === 'streams'} onClick={() => setActiveTab('streams')}>
            All Streams
          </TabButton>
          <TabButton active={activeTab === 'incoming'} onClick={() => setActiveTab('incoming')}>
            Incoming
          </TabButton>
          <TabButton active={activeTab === 'outgoing'} onClick={() => setActiveTab('outgoing')}>
            Outgoing
          </TabButton>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={refreshStreams}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-all disabled:opacity-50"
            title="Refresh streams"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold rounded-lg transition-all transform hover:scale-105"
          >
            <Zap className="w-5 h-5" />
            Create Stream
          </button>
        </div>
      </div>

      {/* Last Refresh Indicator */}
      {lastRefresh && !loading && (
        <div className="text-sm text-gray-400">
          Last updated: {lastRefresh.toLocaleTimeString()}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        </div>
      )}

      {/* Empty State */}
      {!loading && streams.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Layers className="w-8 h-8 text-gray-600" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No streams yet</h3>
          <p className="text-gray-400 mb-6">Create your first payment stream to get started</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold rounded-lg transition-all"
          >
            <Zap className="w-5 h-5" />
            Create Stream
          </button>
        </div>
      )}

      {/* Streams List */}
      {!loading && streams.length > 0 && (
        <div className="space-y-4">
          {streams.map((stream: any) => (
            <StreamCard key={stream.id} stream={stream} walletAddress={walletAddress} />
          ))}
        </div>
      )}
    </div>
  );
}

// Component: Stat Card
function StatCard({ label, value, subtext, icon, gradient }: any) {
  return (
    <div className="relative overflow-hidden p-6 bg-gray-800 border border-gray-700 rounded-xl">
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <span className="text-gray-400 text-sm font-medium">{label}</span>
          <div className={`p-2 bg-gradient-to-br ${gradient} rounded-lg text-white`}>
            {icon}
          </div>
        </div>
        <div className="text-3xl font-bold text-white mb-1">{value}</div>
        <div className="text-gray-400 text-sm">{subtext}</div>
      </div>
      <div className={`absolute -right-8 -bottom-8 w-32 h-32 bg-gradient-to-br ${gradient} opacity-5 rounded-full blur-2xl`}></div>
    </div>
  );
}

// Component: Tab Button
function TabButton({ active, onClick, children }: any) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-md font-medium transition-all ${active
        ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white'
        : 'text-gray-400 hover:text-white'
        }`}
    >
      {children}
    </button>
  );
}

// Component: Stream Card
function StreamCard({ stream, walletAddress }: any) {
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const owedUSDCx = fromMicroUSDCx(stream.owed).toFixed(2);
  const depositUSDCx = fromMicroUSDCx(stream.deposit).toFixed(2);
  const withdrawnUSDCx = fromMicroUSDCx(stream.withdrawn).toFixed(2);
  const ratePerBlock = fromMicroUSDCx(stream.rate).toFixed(4);

  const isOutgoing = stream.type === 'outgoing';
  const isPaused = stream.isPaused || false;

  const handleWithdraw = async () => {
    if (stream.type !== 'incoming' || stream.owed === BigInt(0)) return;

    setIsWithdrawing(true);
    setActionError(null);

    try {
      await withdraw(stream.id);
    } catch (e: any) {
      setActionError(e.message || 'Withdrawal failed');
      console.error('Withdrawal error:', e);
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handlePause = async () => {
    setIsPausing(true);
    setActionError(null);

    try {
      await pauseStream(stream.id);
    } catch (e: any) {
      setActionError(e.message || 'Pause failed');
      console.error('Pause error:', e);
    } finally {
      setIsPausing(false);
    }
  };

  const handleResume = async () => {
    setIsResuming(true);
    setActionError(null);

    try {
      await resumeStream(stream.id);
    } catch (e: any) {
      setActionError(e.message || 'Resume failed');
      console.error('Resume error:', e);
    } finally {
      setIsResuming(false);
    }
  };

  const handleCancel = async () => {
    setIsCancelling(true);
    setActionError(null);

    try {
      await cancelStream(stream.id);
    } catch (e: any) {
      setActionError(e.message || 'Cancel failed');
      console.error('Cancel error:', e);
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <>
      <div className="p-6 bg-gray-800 border border-gray-700 rounded-xl hover:border-orange-500/50 transition-all">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${stream.type === 'incoming'
              ? 'bg-green-500/20 text-green-500'
              : 'bg-orange-500/20 text-orange-500'
              }`}>
              {stream.type === 'incoming' ? (
                <ArrowDownRight className="w-5 h-5" />
              ) : (
                <ArrowUpRight className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-white font-semibold mb-1">Stream #{stream.id}</h3>
              <p className="text-gray-400 text-sm font-mono">
                {stream.type === 'incoming' ? stream.sender : stream.recipient}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isPaused && (
              <div className="px-3 py-1 text-xs font-semibold rounded-full border bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
                Paused
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
          <Metric label="Rate" value={`${ratePerBlock} USDCx / interval`} />
          <Metric label="Interval" value={`${stream.interval || 1} blocks`} />
          <Metric label="Deposit" value={`${depositUSDCx} USDCx`} />
          <Metric label="Withdrawn" value={`${withdrawnUSDCx} USDCx`} />
          <Metric label="Available" value={`${owedUSDCx} USDCx`} highlight />
        </div>

        {actionError && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm">{actionError}</p>
          </div>
        )}

        <div className="flex gap-3 flex-wrap">
          {/* Withdraw Button - Incoming Only */}
          {!isOutgoing && !isPaused && (
            <button
              onClick={handleWithdraw}
              disabled={isWithdrawing || stream.owed === BigInt(0)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isWithdrawing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Withdrawing...
                </>
              ) : (
                <>
                  <ArrowDownRight className="w-4 h-4" />
                  Withdraw {owedUSDCx} USDCx
                </>
              )}
            </button>
          )}

          {/* Pause/Resume Button - Outgoing Only */}
          {isOutgoing && (
            <>
              {!isPaused ? (
                <button
                  onClick={handlePause}
                  disabled={isPausing}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPausing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Pausing...
                    </>
                  ) : (
                    <>
                      <Pause className="w-4 h-4" />
                      Pause Stream
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleResume}
                  disabled={isResuming}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResuming ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Resuming...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Resume Stream
                    </>
                  )}
                </button>
              )}
            </>
          )}

          {/* Top-up Button - Outgoing Only */}
          {isOutgoing && (
            <button
              onClick={() => setShowTopUpModal(true)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold rounded-lg transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              Top-up
            </button>
          )}

          {/* Cancel Button - Outgoing Only */}
          {isOutgoing && (
            <button
              onClick={handleCancel}
              disabled={isCancelling}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCancelling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                <>
                  <X className="w-4 h-4" />
                  Cancel Stream
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Top-up Modal */}
      {showTopUpModal && (
        <TopUpModal
          streamId={stream.id}
          address={walletAddress}
          onClose={() => setShowTopUpModal(false)}
        />
      )}
    </>
  );
}

// Component: Metric
function Metric({ label, value, highlight }: any) {
  return (
    <div>
      <div className="text-gray-400 text-xs mb-1">{label}</div>
      <div className={`font-semibold ${highlight ? 'text-orange-500' : 'text-white'}`}>
        {value}
      </div>
    </div>
  );
}

// Component: Create Stream Modal
function CreateStreamModal({ onClose, senderAddress, balance }: { onClose: () => void; senderAddress: string, balance: bigint }) {
  const [formData, setFormData] = useState({
    recipient: '',
    rate: '',
    deposit: '',
    interval: '1'
  });
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const [intervalType, setIntervalType] = useState<'blocks' | 'hours' | 'days'>('blocks');

  const getIntervalInBlocks = () => {
    const value = parseFloat(formData.interval || '1');

    if (intervalType === 'hours') return Math.floor(value * 720);   // 720 blocks per hour
    if (intervalType === 'days') return Math.floor(value * 17280);   // 17,280 blocks per day
    return Math.floor(value); // blocks
  };

  const handleCreate = async () => {
    setError(null);
    setWarning(null);

    // Validation
    if (!formData.recipient || !formData.rate || !formData.deposit) {
      setError('All fields are required');
      return;
    }

    const rate = parseFloat(formData.rate);
    const deposit = parseFloat(formData.deposit);
    const intervalBlocks = getIntervalInBlocks();

    if (Number.isNaN(rate) || Number.isNaN(deposit)) {
      setError('Invalid number format');
      return;
    }

    if (rate <= 0 || deposit <= 0) {
      setError('Rate and deposit must be greater than 0');
      return;
    }

    if (intervalBlocks < 1) {
      setError('Payment interval must be at least 1 block');
      return;
    }

    if (deposit < rate) {
      setError('Deposit must be at least one full interval payment');
      return;
    }

    if (deposit < rate * 2) {
      setWarning('This stream will last only one interval');
    }

    setIsCreating(true);

    try {
      await createStream(
        senderAddress,
        formData.recipient,
        toMicroUSDCx(rate),
        toMicroUSDCx(deposit),
        BigInt(getIntervalInBlocks())
      );

      // Success - close modal
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to create stream');
      console.error('Create stream error:', e);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Create New Stream</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {warning && (
          <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-500" />
            <p className="text-yellow-400 text-sm">{warning}</p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Recipient Address
            </label>
            <input
              type="text"
              placeholder="ST1PQHQKV0RJ..."
              value={formData.recipient}
              onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Rate (USDCx per interval)
            </label>
            <input
              type="number"
              placeholder="1.0"
              step="0.1"
              value={formData.rate}
              onChange={(e) => {
                const rate = Number(e.target.value);
                const duration = formData.rate && formData.deposit ? (Math.floor(parseFloat(formData.deposit) / parseFloat(formData.rate)) * getIntervalInBlocks()) : null

                if (rate > 10_000) {
                  setWarning(`Rate cannot exceed 10,000 per interval`);
                } else if (duration === 0) {
                  setWarning(`Duration cannot be 0 blocks`);
                } else {
                  setWarning(null);
                }

                setFormData({ ...formData, rate: e.target.value });
              }}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors"
            />
            <p className="text-gray-400 text-xs mt-1">
              ~{(parseFloat(formData.rate || '0') * 52560).toFixed(2)} USDCx per year
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Total Deposit (USDCx)
            </label>
            <input
              type="number"
              placeholder="100.0"
              step="1"
              value={formData.deposit}
              onChange={(e) => {
                const deposit = Number(e.target.value);
                const duration = formData.rate && formData.deposit ? (Math.floor(parseFloat(formData.deposit) / parseFloat(formData.rate)) * getIntervalInBlocks()) : null

                if (deposit > fromMicroUSDCx(balance)) {
                  setWarning(`Deposit cannot exceed balance`);
                } else if (duration === 0) {
                  setWarning(`Duration cannot be 0 blocks`);
                } else {
                  setWarning(null);
                }

                setFormData({ ...formData, deposit: e.target.value });
              }}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors"
            />
            <p className="text-gray-400 text-xs mt-1">
              Total duration: {formData.rate && formData.deposit
                ? Math.floor(parseFloat(formData.deposit) / parseFloat(formData.rate)) * getIntervalInBlocks()
                : 0} blocks (~{formData.rate && formData.deposit
                  ? (Math.floor(parseFloat(formData.deposit) / parseFloat(formData.rate)) * getIntervalInBlocks() / 17280).toFixed(2)
                  : 0} days)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Payment Interval
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="1"
                min="1"
                step="1"
                value={formData.interval}
                onChange={(e) => {
                  const intervalBlocks = getIntervalInBlocks();
                  const duration = formData.rate && formData.deposit ? (Math.floor(parseFloat(formData.deposit) / parseFloat(formData.rate)) * intervalBlocks) : null

                  if (intervalBlocks > 100_000_000) {
                    setWarning(`Interval cannot exceed 100,000,000 blocks (5780~ days estimated at 5sec/block)`);
                  } else if (duration === 0) {
                    setWarning(`Duration cannot be 0 blocks`);
                  } else {
                    setWarning(null);
                  }

                  setFormData({ ...formData, interval: e.target.value });
                }}
                className="flex-1 px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors"
              />
              <select
                value={intervalType}
                onChange={(e) => setIntervalType(e.target.value as any)}
                className="px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-orange-500 transition-colors"
              >
                <option value="blocks">Blocks</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </select>
            </div>
            <p className="text-gray-400 text-xs mt-1">
              Payment released every {formData.interval} {intervalType}
              {intervalType !== 'blocks' && ` (~${getIntervalInBlocks()} blocks)`}
            </p>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              onClick={onClose}
              disabled={isCreating}
              className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={isCreating}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold rounded-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Stream'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Component: Top-up Modal
function TopUpModal({ streamId, address, onClose }: { streamId: number; address: string, onClose: () => void }) {
  const [amount, setAmount] = useState('');
  const [isTopping, setIsTopping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTopUp = async () => {
    setError(null);

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setIsTopping(true);

    try {
      await topUpStream(address, streamId, toMicroUSDCx(parseFloat(amount)));
      onClose();
    } catch (e: any) {
      setError(e.message || 'Top-up failed');
      console.error('Top-up error:', e);
    } finally {
      setIsTopping(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Top-up Stream #{streamId}</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Additional Amount (USDCx)
            </label>
            <input
              type="number"
              placeholder="100.0"
              step="0.1"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
            <p className="text-gray-400 text-xs mt-1">
              This will extend the stream duration
            </p>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              onClick={onClose}
              disabled={isTopping}
              className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleTopUp}
              disabled={isTopping}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold rounded-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
            >
              {isTopping ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <PlusCircle className="w-5 h-5" />
                  Top-up Stream
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}