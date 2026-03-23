import { ethers } from 'ethers';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import {
    getAccessRequests,
    getIncomingRequests,
    requestWalletLinkNonce,
    verifyWalletLink,
} from '../services/api';
import { extractApiError } from '../utils/apiError';

const UserProfile = () => {
    const { user, updateUser } = useAuth();
    const location = useLocation();

    const [walletLoading, setWalletLoading] = useState(false);
    const [refreshLoading, setRefreshLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [walletInfo, setWalletInfo] = useState({
        address: '',
        chainId: '',
        balanceEth: '0',
    });

    const [walletStats, setWalletStats] = useState({
        totalReceivedEth: '0',
        totalPaidEth: '0',
        txCount: 0,
        lastPaymentTxHash: null,
    });

    const walletTitle = useMemo(() => {
        if (location.pathname === '/wallet') return 'Wallet Details';
        return 'Profile';
    }, [location.pathname]);

    const loadWalletMetrics = useCallback(async (forceAccountPrompt = false) => {
        if (!window.ethereum || (user?.role !== 'doctor' && user?.role !== 'patient')) {
            return;
        }

        const provider = new ethers.BrowserProvider(window.ethereum);
        const method = forceAccountPrompt ? 'eth_requestAccounts' : 'eth_accounts';
        const accounts = await provider.send(method, []);
        if (!accounts || accounts.length === 0) {
            return;
        }

        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        const [network, balanceWei] = await Promise.all([
            provider.getNetwork(),
            provider.getBalance(address),
        ]);

        setWalletInfo({
            address,
            chainId: network.chainId.toString(),
            balanceEth: ethers.formatEther(balanceWei),
        });

        const requestsResponse = user.role === 'doctor'
            ? await getAccessRequests()
            : await getIncomingRequests();

        const requests = requestsResponse.data?.requests || [];
        const paidRequests = requests.filter((item) => item.status === 'granted' && item.paymentTxHash);

        let totalWei = 0n;
        let txCount = 0;
        let lastPaymentTxHash = null;

        await Promise.all(
            paidRequests.map(async (item) => {
                try {
                    const tx = await provider.getTransaction(item.paymentTxHash);
                    if (!tx || !tx.value) return;

                    const isDoctorIncome = user.role === 'doctor' && tx.to && tx.to.toLowerCase() === address.toLowerCase();
                    const isPatientSpend = user.role === 'patient' && tx.from && tx.from.toLowerCase() === address.toLowerCase();

                    if (!isDoctorIncome && !isPatientSpend) return;

                    totalWei += tx.value;
                    txCount += 1;
                    if (!lastPaymentTxHash) {
                        lastPaymentTxHash = tx.hash;
                    }
                } catch (txErr) {
                    console.error('Failed to fetch transaction details for wallet stats:', txErr);
                }
            })
        );

        setWalletStats({
            totalReceivedEth: user.role === 'doctor' ? ethers.formatEther(totalWei) : '0',
            totalPaidEth: user.role === 'patient' ? ethers.formatEther(totalWei) : '0',
            txCount,
            lastPaymentTxHash,
        });
    }, [user?.role]);

    useEffect(() => {
        const init = async () => {
            try {
                await loadWalletMetrics(false);
            } catch (err) {
                console.error('Wallet metrics preload failed:', err);
            }
        };

        init();
    }, [loadWalletMetrics, user?.ethereumAddress]);

    const flashSuccess = (message) => {
        setSuccess(message);
        setTimeout(() => setSuccess(''), 3500);
    };

    const handleConnectWallet = async () => {
        setError('');
        setWalletLoading(true);

        try {
            if (!window.ethereum) {
                setError('MetaMask not detected. Please install MetaMask first.');
                return;
            }

            const provider = new ethers.BrowserProvider(window.ethereum);
            await provider.send('eth_requestAccounts', []);
            const signer = await provider.getSigner();
            const address = (await signer.getAddress()).toLowerCase();

            const nonceRes = await requestWalletLinkNonce(address);
            const message = nonceRes.data?.message;
            if (!message) {
                throw new Error('Wallet link message was not returned by server.');
            }

            const signature = await signer.signMessage(message);
            const verifyRes = await verifyWalletLink(address, signature);
            const linkedUser = verifyRes.data?.user;

            if (linkedUser) {
                updateUser(linkedUser);
            }

            await loadWalletMetrics(false);
            flashSuccess('Wallet connected and profile updated successfully.');
        } catch (err) {
            if (err?.code === 'ACTION_REJECTED' || err?.code === 4001) {
                setError('MetaMask signature was rejected. Wallet was not linked.');
            } else {
                setError(extractApiError(err, 'Failed to connect wallet.'));
            }
        } finally {
            setWalletLoading(false);
        }
    };

    const handleRefreshWallet = async () => {
        setError('');
        setRefreshLoading(true);
        try {
            await loadWalletMetrics(false);
            flashSuccess('Wallet details refreshed.');
        } catch (err) {
            setError(extractApiError(err, 'Could not refresh wallet details.'));
        } finally {
            setRefreshLoading(false);
        }
    };

    return (
        <>
            <Navbar />
            <div className="page-container">
                <h1 className="page-title">{walletTitle}</h1>

                {error && <div className="alert alert-error">{error}</div>}
                {success && <div className="alert alert-success">{success}</div>}

                <div className="card profile-card">
                    <div className="card-header">
                        <h2>Account Overview</h2>
                    </div>

                    <div className="profile-grid">
                        <div className="profile-kv">
                            <span className="profile-label">Name</span>
                            <span className="profile-value">{user?.name || '—'}</span>
                        </div>
                        <div className="profile-kv">
                            <span className="profile-label">Email</span>
                            <span className="profile-value">{user?.email || '—'}</span>
                        </div>
                        <div className="profile-kv">
                            <span className="profile-label">Role</span>
                            <span className="profile-value text-capitalize">{user?.role || '—'}</span>
                        </div>
                        <div className="profile-kv">
                            <span className="profile-label">Approval Status</span>
                            <span className="profile-value">{user?.isApproved ? 'Approved' : 'Pending approval'}</span>
                        </div>
                    </div>
                </div>

                {(user?.role === 'doctor' || user?.role === 'patient') && (
                    <div className="card profile-card">
                        <div className="card-header">
                            <h2>Wallet Overview</h2>
                            <div className="profile-actions">
                                <button className="btn btn-primary btn-sm" onClick={handleConnectWallet} disabled={walletLoading}>
                                    {walletLoading ? 'Connecting…' : user?.ethereumAddress ? 'Reconnect Wallet' : 'Connect Wallet'}
                                </button>
                                <button className="btn btn-soft btn-sm" onClick={handleRefreshWallet} disabled={refreshLoading}>
                                    {refreshLoading ? 'Refreshing…' : 'Refresh'}
                                </button>
                            </div>
                        </div>

                        <div className="profile-grid wallet-grid">
                            <div className="profile-kv">
                                <span className="profile-label">Linked Wallet</span>
                                <span className="profile-value wallet-mono">{user?.ethereumAddress || 'Not linked'}</span>
                            </div>
                            <div className="profile-kv">
                                <span className="profile-label">Connected Wallet</span>
                                <span className="profile-value wallet-mono">{walletInfo.address || 'Not connected'}</span>
                            </div>
                            <div className="profile-kv">
                                <span className="profile-label">Chain ID</span>
                                <span className="profile-value">{walletInfo.chainId || '—'}</span>
                            </div>
                            <div className="profile-kv">
                                <span className="profile-label">Live Balance</span>
                                <span className="profile-value">{walletInfo.balanceEth || '0'} ETH</span>
                            </div>
                            {user?.role === 'doctor' && (
                                <>
                                    <div className="profile-kv">
                                        <span className="profile-label">Consultation ETH Received</span>
                                        <span className="profile-value">{walletStats.totalReceivedEth} ETH</span>
                                    </div>
                                    <div className="profile-kv">
                                        <span className="profile-label">Received Transactions</span>
                                        <span className="profile-value">{walletStats.txCount}</span>
                                    </div>
                                </>
                            )}
                            {user?.role === 'patient' && (
                                <>
                                    <div className="profile-kv">
                                        <span className="profile-label">Consultation ETH Paid</span>
                                        <span className="profile-value">{walletStats.totalPaidEth} ETH</span>
                                    </div>
                                    <div className="profile-kv">
                                        <span className="profile-label">Payment Transactions</span>
                                        <span className="profile-value">{walletStats.txCount}</span>
                                    </div>
                                </>
                            )}
                            <div className="profile-kv profile-kv-wide">
                                <span className="profile-label">Latest Payment Transaction</span>
                                <span className="profile-value wallet-mono">{walletStats.lastPaymentTxHash || '—'}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default UserProfile;
