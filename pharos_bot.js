require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const { HttpsProxyAgent } = require('https-proxy-agent');
const randomUseragent = require('random-useragent');
const axios = require('axios');
const prompt = require('prompt-sync')({ sigint: true });

// Define ANSI escape codes for console colors
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  white: '\x1b[37m',
  bold: '\x1b[1m',
  blue: '\x1b[34m',    // Added blue for table elements
  magenta: '\x1b[35m', // Added magenta for banner
};

// Custom logger for colorful console output
const logger = {
  info: (msg) => console.log(`${colors.green}[✓] ${msg}${colors.reset}`),
  wallet: (msg) => console.log(`${colors.yellow}[➤] ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}[!] ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}[✗] ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}[+] ${msg}${colors.reset}`),
  loading: (msg) => console.log(`${colors.cyan}[⟳] ${msg}${colors.reset}`),
  step: (msg) => console.log(`${colors.white}[➤] ${msg}${colors.reset}`),
  user: (msg) => console.log(`\n${colors.white}[➤] ${msg}${colors.reset}`),

  // Updated banner with attractive text and colors
  banner: () => {
    const asciiBannerLines = [
      `${colors.bold}${colors.cyan}██████╗     ██╗  ██╗     █████╗     ██████╗      ██████╗     ███████╗${colors.reset}`,
      `${colors.bold}${colors.cyan}██╔══██╗    ██║  ██║    ██╔══██╗    ██╔══██╗    ██╔═══██╗    ██╔════╝${colors.reset}`,
      `${colors.bold}${colors.cyan}██████╔╝    ███████║    ███████║    ██████╔╝    ██║   ██║    ███████╗${colors.reset}`,
      `${colors.bold}${colors.cyan}██╔═══╝     ██╔══██║    ██╔══██║    ██╔══██╗    ██║   ██║    ╚════██║${colors.reset}`,
      `${colors.bold}${colors.cyan}██║         ██║  ██║    ██║  ██║    ██║  ██║    ╚██████╔╝    ███████║${colors.reset}`,
      `${colors.bold}${colors.cyan}╚═╝         ╚═╝  ╚═╝    ╚═╝  ╚═╝     ╚═╝  ╚═╝     ╚═════╝     ╚══════╝${colors.reset}`,
      "",
      `       ${colors.bold}${colors.magenta}🚀 Pharos Testnet Multi-Bot | Powered by WARHU 🚀${colors.reset}       `,
      `       ${colors.bold}${colors.green}✨ Consistency is Key, Curiosity Lights the Way. ✨${colors.reset}       `,
    ];

    asciiBannerLines.forEach((line) => console.log(line));
    console.log(`\n`);
  },
};


// Network configuration for Pharos Testnet
const networkConfig = {
  name: 'Pharos Testnet',
  chainId: 688688,
  rpcUrl: 'https://testnet.dplabs-internal.com',
  currencySymbol: 'PHRS',
};

// Token and contract addresses
const tokens = {
  USDC: '0xad902cf99c2de2f1ba5ec4d642fd7e49cae9ee37',
  WPHRS: '0x76aaada469d23216be5f7c596fa25f282ff9b364',
  USDT: '0xed59de2d7ad9c043442e381231ee3646fc3c2939',
  POSITION_MANAGER: '0xF8a1D4FF0f9b9Af7CE58E1fc1833688F3BFd6115',
};

const poolAddresses = {
  USDC_WPHRS: '0x0373a059321219745aee4fad8a942cf088be3d0e',
  USDT_WPHRS: '0x70118b6eec45329e0534d849bc3e588bb6752527',
};

const contractAddress = '0x1a4de519154ae51200b0ad7c90f7fac75547888a';

const tokenDecimals = {
  WPHRS: 18,
  USDC: 6,
  USDT: 6,
};

// ABIs for contracts
const contractAbi = [
  {
    inputs: [
      { internalType: 'uint256', name: 'collectionAndSelfcalls', type: 'uint256' },
      { internalType: 'bytes[]', name: 'data', type: 'bytes[]' },
    ],
    name: 'multicall',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

const erc20Abi = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) public returns (bool)',
  'function decimals() view returns (uint8)',
  'function deposit() public payable',
  'function withdraw(uint256 wad) public',
];

const positionManagerAbi = [
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'token0', type: 'address' },
          { internalType: 'address', name: 'token1', type: 'address' },
          { internalType: 'uint24', name: 'fee', type: 'uint24' },
          { internalType: 'int24', name: 'tickLower', type: 'int24' },
          { internalType: 'int24', name: 'tickUpper', type: 'int24' },
          { internalType: 'uint256', name: 'amount0Desired', type: 'uint256' },
          { internalType: 'uint256', name: 'amount1Desired', type: 'uint256' },
          { internalType: 'uint256', name: 'amount0Min', type: 'uint256' },
          { internalType: 'uint256', name: 'amount1Min', type: 'uint256' },
          { internalType: 'address', name: 'recipient', type: 'address' },
          { internalType: 'uint256', name: 'deadline', type: 'uint256' },
        ],
        internalType: 'struct INonfungiblePositionManager.MintParams',
        name: 'params',
        type: 'tuple',
      },
    ],
    name: 'mint',
    outputs: [
      { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
      { internalType: 'uint128', name: 'liquidity', type: 'uint128' },
      { internalType: 'uint256', name: 'amount0', type: 'uint256' },
      { internalType: 'uint256', name: 'amount1', type: 'uint256' },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
];

// Options for different transaction types
const pairOptions = [
  { id: 1, from: 'WPHRS', to: 'USDC', amount: 0.0001 },
  { id: 2, from: 'WPHRS', to: 'USDT', amount: 0.0001 },
  { id: 3, from: 'USDC', to: 'WPHRS', amount: 0.0001 },
  { id: 4, from: 'USDT', to: 'WPHRS', amount: 0.0001 },
  { id: 5, from: 'USDC', to: 'USDT', amount: 0.0001 },
  { id: 6, from: 'USDT', to: 'USDC', amount: 0.0001 },
];

const lpOptions = [
  { id: 1, token0: 'WPHRS', token1: 'USDC', amount0: 0.0001, amount1: 0.0001, fee: 3000 },
  { id: 2, token0: 'WPHRS', token1: 'USDT', amount0: 0.0001, amount1: 0.0001, fee: 3000 },
];

// Function to load proxies from 'proxies.txt'
const loadProxies = () => {
  try {
    const proxies = fs.readFileSync('proxies.txt', 'utf8')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line);
    return proxies;
  } catch (error) {
    logger.warn('No proxies.txt found or failed to load, switching to direct mode');
    return [];
  }
};

// Function to get a random proxy from the loaded list
const getRandomProxy = (proxies) => {
  return proxies[Math.floor(Math.random() * proxies.length)];
};

// Function to set up the ethers provider, with or without a proxy
const setupProvider = (proxy = null) => {
  if (proxy) {
    logger.info(`Using proxy: ${proxy}`);
    const agent = new HttpsProxyAgent(proxy);
    return new ethers.JsonRpcProvider(networkConfig.rpcUrl, {
      chainId: networkConfig.chainId,
      name: networkConfig.name,
    }, {
      fetchOptions: { agent },
      headers: { 'User-Agent': randomUseragent.getRandom() },
    });
  } else {
    logger.info('Using direct mode (no proxy)');
    return new ethers.JsonRpcProvider(networkConfig.rpcUrl, {
      chainId: networkConfig.chainId,
      name: networkConfig.name,
    });
  }
};

// Function to wait for a transaction receipt with retries
const waitForTransactionWithRetry = async (provider, txHash, maxRetries = 5, baseDelayMs = 1000) => {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      const receipt = await provider.getTransactionReceipt(txHash);
      if (receipt) {
        return receipt;
      }
      logger.warn(`Transaction receipt not found for ${txHash}, retrying (${retries + 1}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, baseDelayMs * Math.pow(2, retries)));
      retries++;
    } catch (error) {
      logger.error(`Error fetching transaction receipt for ${txHash}: ${error.message}`);
      if (error.code === -32008) {
        logger.warn(`RPC error -32008, retrying (${retries + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, baseDelayMs * Math.pow(2, retries)));
        retries++;
      } else {
        throw error;
      }
    }
  }
  throw new Error(`Failed to get transaction receipt for ${txHash} after ${maxRetries} retries`);
};

// Function to check token balance and perform approval if necessary
const checkBalanceAndApproval = async (wallet, tokenAddress, amount, decimals, spender) => {
  try {
    const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, wallet);
    const balance = await tokenContract.balanceOf(wallet.address);
    const required = ethers.parseUnits(amount.toString(), decimals);

    if (balance < required) {
      logger.warn(
        `Skipping: Insufficient ${Object.keys(tokenDecimals).find(
          key => tokenDecimals[key] === decimals
        )} balance: ${ethers.formatUnits(balance, decimals)} < ${amount}`
      );
      return false;
    }

    const allowance = await tokenContract.allowance(wallet.address, spender);
    if (allowance < required) {
      logger.step(`Approving ${amount} tokens for ${spender}...`);
      const estimatedGas = await tokenContract.approve.estimateGas(spender, ethers.MaxUint256);
      const feeData = await wallet.provider.getFeeData();
      const gasPrice = feeData.gasPrice || ethers.parseUnits('1', 'gwei');
      const approveTx = await tokenContract.approve(spender, ethers.MaxUint256, {
        gasLimit: Math.ceil(Number(estimatedGas) * 1.2),
        gasPrice,
        maxFeePerGas: feeData.maxFeePerGas || undefined,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || undefined,
      });
      const receipt = await waitForTransactionWithRetry(wallet.provider, approveTx.hash);
      logger.success('Approval completed');
    }

    return true;
  } catch (error) {
    logger.error(`Balance/approval check failed: ${error.message}`);
    return false;
  }
};

// Function to fetch user information from Pharos Network API
const getUserInfo = async (wallet, proxy = null, jwt) => {
  try {
    logger.user(`Fetching user info for wallet: ${wallet.address}`);
    const profileUrl = `https://api.pharosnetwork.xyz/user/profile?address=${wallet.address}`;
    const headers = {
      accept: "application/json, text/plain, */*",
      "accept-language": "en-US,en;q=0.8",
      authorization: `Bearer ${jwt}`,
      "sec-ch-ua": '"Chromium";v="136", "Brave";v="136", "Not.A/Brand";v="99"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      "sec-gpc": "1",
      Referer: "https://testnet.pharosnetwork.xyz/",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "User-Agent": randomUseragent.getRandom(),
    };

    const axiosConfig = {
      method: 'get',
      url: profileUrl,
      headers,
      httpsAgent: proxy ? new HttpsProxyAgent(proxy) : null,
    };

    logger.loading('Fetching user profile...');
    const response = await axios(axiosConfig);
    const data = response.data;

    if (data.code !== 0 || !data.data.user_info) {
      logger.error(`Failed to fetch user info: ${data.msg || 'Unknown error'}`);
      return;
    }

    const userInfo = data.data.user_info;
    logger.info(`User ID: ${userInfo.ID}`);
    logger.info(`Task Points: ${userInfo.TaskPoints}`);
    logger.info(`Total Points: ${userInfo.TotalPoints}`);
  } catch (error) {
    logger.error(`Failed to fetch user info: ${error.message}`);
  }
};

// Function to verify a task on Pharos Network API
const verifyTask = async (wallet, proxy, jwt, txHash) => {
  try {
    logger.step(`Verifying task ID 103 for transaction: ${txHash}`);
    const verifyUrl = `https://api.pharosnetwork.xyz/task/verify?address=${wallet.address}&task_id=103&tx_hash=${txHash}`;
    
    const headers = {
      accept: "application/json, text/plain, */*",
      "accept-language": "en-US,en;q=0.8",
      authorization: `Bearer ${jwt}`,
      priority: "u=1, i",
      "sec-ch-ua": '"Chromium";v="136", "Brave";v="136", "Not.A/Brand";v="99"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      "sec-gpc": "1",
      Referer: "https://testnet.pharosnetwork.xyz/",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "User-Agent": randomUseragent.getRandom(),
    };

    const axiosConfig = {
      method: 'post',
      url: verifyUrl,
      headers,
      httpsAgent: proxy ? new HttpsProxyAgent(proxy) : null,
    };

    logger.loading('Sending task verification request...');
    const response = await axios(axiosConfig);
    const data = response.data;

    if (data.code === 0 && data.data.verified) {
      logger.success(`Task ID 103 verified successfully for ${txHash}`);
      return true;
    } else {
      logger.warn(`Task verification failed: ${data.msg || 'Unknown error'}`);
      return false;
    }
  } catch (error) {
    logger.error(`Task verification failed for ${txHash}: ${error.message}`);
    return false;
  }
};

// Function to get multicall data for swaps
const getMulticallData = (pair, amount, walletAddress) => {
  try {
    const decimals = tokenDecimals[pair.from];
    const scaledAmount = ethers.parseUnits(amount.toString(), decimals);

    const data = ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'address', 'uint256', 'address', 'uint256', 'uint256', 'uint256'],
      [
        tokens[pair.from],
        tokens[pair.to],
        500, // This is likely the fee tier, e.g., 0.05%
        walletAddress,
        scaledAmount,
        0, // amountOutMin
        0, // sqrtPriceLimitX96
      ]
    );

    return [ethers.concat(['0x04e45aaf', data])]; // `0x04e45aaf` is the function selector for `exactInputSingle`
  } catch (error) {
    logger.error(`Failed to generate multicall data: ${error.message}`);
    return [];
  }
};

// Function to perform a token swap
const performSwap = async (wallet, provider, index, jwt, proxy) => {
  let txHash = 'N/A';
  let status = 'Failed';
  let explorerLink = 'N/A';
  // Initialize pairDescription robustly, in case pair assignment itself fails or is incomplete
  let pairDescription = `Swap (Index ${index + 1})`; 

  try {
    const pair = pairOptions[Math.floor(Math.random() * pairOptions.length)];
    // Defensive check to ensure 'pair' is a valid object
    if (!pair || typeof pair.from === 'undefined' || typeof pair.to === 'undefined') {
      throw new Error("Could not select a valid pair for swap or pair data is incomplete.");
    }
    pairDescription = `${pair.from} -> ${pair.to}`; // Update description if pair is valid

    const amount = pair.amount;
    logger.step(
      `Preparing swap ${index + 1}: ${pairDescription} (${amount} ${pair.from})`
    );

    const decimals = tokenDecimals[pair.from];
    const tokenContract = new ethers.Contract(tokens[pair.from], erc20Abi, provider);
    const balance = await tokenContract.balanceOf(wallet.address);
    const required = ethers.parseUnits(amount.toString(), decimals);

    if (balance < required) {
      logger.warn(
        `Skipping swap ${index + 1}: Insufficient ${pair.from} balance: ${ethers.formatUnits(
          balance,
          decimals
        )} < ${amount}`
      );
      // Ensure 'pairDescription' is used consistently in return
      return { walletAddress: wallet.address, action: `Swap ${pairDescription}`, status: 'Skipped', txHash, explorerLink };
    }

    if (!(await checkBalanceAndApproval(wallet, tokens[pair.from], amount, decimals, contractAddress))) {
      return { walletAddress: wallet.address, action: `Swap ${pairDescription}`, status: 'Approval Failed', txHash, explorerLink };
    }

    const contract = new ethers.Contract(contractAddress, contractAbi, wallet);
    const multicallData = getMulticallData(pair, amount, wallet.address);

    if (!multicallData || multicallData.length === 0 || multicallData.some(data => !data || data === '0x')) {
      logger.error(`Invalid or empty multicall data for ${pairDescription}`);
      return { walletAddress: wallet.address, action: `Swap ${pairDescription}`, status: 'Invalid Data', txHash, explorerLink };
    }

    const deadline = Math.floor(Date.now() / 1000) + 300;
    let estimatedGas;
    try {
      estimatedGas = await contract.multicall.estimateGas(deadline, multicallData, {
        from: wallet.address,
      });
    } catch (error) {
      logger.error(`Gas estimation failed for swap ${index + 1}: ${error.message}`);
      return { walletAddress: wallet.address, action: `Swap ${pairDescription}`, status: 'Gas Estimation Failed', txHash, explorerLink };
    }

    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || ethers.parseUnits('1', 'gwei');
    const tx = await contract.multicall(deadline, multicallData, {
      gasLimit: Math.ceil(Number(estimatedGas) * 1.2),
      gasPrice,
      maxFeePerGas: feeData.maxFeePerGas || undefined,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || undefined,
    });

    logger.loading(`Swap transaction ${index + 1} sent, waiting for confirmation...`);
    const receipt = await waitForTransactionWithRetry(provider, tx.hash);
    
    txHash = receipt.hash;
    status = 'Success';
    explorerLink = `https://testnet.pharosscan.xyz/tx/${receipt.hash}`;
    logger.success(`Swap ${index + 1} completed: ${receipt.hash}`);
    logger.step(`Explorer: ${explorerLink}`);

    await verifyTask(wallet, proxy, jwt, receipt.hash);
    return { walletAddress: wallet.address, action: `Swap ${pairDescription}`, status, txHash, explorerLink };
  } catch (error) {
    logger.error(`Swap ${index + 1} failed: ${error.message}`);
    if (error.transaction) {
      logger.error(`Transaction details: ${JSON.stringify(error.transaction, null, 2)}`);
    }
    if (error.receipt) {
      logger.error(`Receipt: ${JSON.stringify(error.receipt, null, 2)}`);
    }
    // Use the robustly defined pairDescription here
    return { walletAddress: wallet.address, action: `Swap ${pairDescription}`, status, txHash, explorerLink };
  }
};

// Function to transfer PHRS to a random address
const transferPHRS = async (wallet, provider, index, jwt, proxy) => {
  let txHash = 'N/A';
  let status = 'Failed';
  let explorerLink = 'N/A';

  try {
    const amount = 0.000001;
    const randomWallet = ethers.Wallet.createRandom();
    const toAddress = randomWallet.address;
    logger.step(`Preparing PHRS transfer ${index + 1}: ${amount} PHRS to ${toAddress}`);

    const balance = await provider.getBalance(wallet.address);
    const required = ethers.parseEther(amount.toString());

    if (balance < required) {
      logger.warn(`Skipping transfer ${index + 1}: Insufficient PHRS balance: ${ethers.formatEther(balance)} < ${amount}`);
      return { walletAddress: wallet.address, action: `Transfer PHRS`, status: 'Skipped', txHash, explorerLink };
    }

    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || ethers.parseUnits('1', 'gwei');
    const tx = await wallet.sendTransaction({
      to: toAddress,
      value: required,
      gasLimit: 21000,
      gasPrice,
      maxFeePerGas: feeData.maxFeePerGas || undefined,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || undefined,
    });

    logger.loading(`Transfer transaction ${index + 1} sent, waiting for confirmation...`);
    const receipt = await waitForTransactionWithRetry(provider, tx.hash);
    
    txHash = receipt.hash;
    status = 'Success';
    explorerLink = `https://testnet.pharosscan.xyz/tx/${receipt.hash}`;
    logger.success(`Transfer ${index + 1} completed: ${receipt.hash}`);
    logger.step(`Explorer: ${explorerLink}`);

    await verifyTask(wallet, proxy, jwt, receipt.hash);
    return { walletAddress: wallet.address, action: `Transfer PHRS`, status, txHash, explorerLink };
  } catch (error) {
    logger.error(`Transfer ${index + 1} failed: ${error.message}`);
    if (error.transaction) {
      logger.error(`Transaction details: ${JSON.stringify(error.transaction, null, 2)}`);
    }
    if (error.receipt) {
      logger.error(`Receipt: ${JSON.stringify(error.receipt, null, 2)}`);
    }
    return { walletAddress: wallet.address, action: `Transfer PHRS`, status, txHash, explorerLink };
  }
};

// Function to wrap PHRS to WPHRS
const wrapPHRS = async (wallet, provider, index, jwt, proxy) => {
  let txHash = 'N/A';
  let status = 'Failed';
  let explorerLink = 'N/A';

  try {
    const minAmount = 0.001;
    const maxAmount = 0.005;
    const amount = minAmount + Math.random() * (maxAmount - minAmount);
    const amountWei = ethers.parseEther(amount.toFixed(6).toString());
    logger.step(`Preparing wrap PHRS ${index + 1}: ${amount.toFixed(6)} PHRS to WPHRS`);

    const balance = await provider.getBalance(wallet.address);
    if (balance < amountWei) {
      logger.warn(`Skipping wrap ${index + 1}: Insufficient PHRS balance: ${ethers.formatEther(balance)} < ${amount.toFixed(6)}`);
      return { walletAddress: wallet.address, action: `Wrap PHRS`, status: 'Skipped', txHash, explorerLink };
    }

    const wphrsContract = new ethers.Contract(tokens.WPHRS, erc20Abi, wallet);
    let estimatedGas;
    try {
      estimatedGas = await wphrsContract.deposit.estimateGas({ value: amountWei });
    } catch (error) {
      logger.error(`Gas estimation failed for wrap ${index + 1}: ${error.message}`);
      return { walletAddress: wallet.address, action: `Wrap PHRS`, status: 'Gas Estimation Failed', txHash, explorerLink };
    }

    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || ethers.parseUnits('1', 'gwei');
    const tx = await wphrsContract.deposit({
      value: amountWei,
      gasLimit: Math.ceil(Number(estimatedGas) * 1.2),
      gasPrice,
      maxFeePerGas: feeData.maxFeePerGas || undefined,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || undefined,
    });

    logger.loading(`Wrap transaction ${index + 1} sent, waiting for confirmation...`);
    const receipt = await waitForTransactionWithRetry(provider, tx.hash);
    
    txHash = receipt.hash;
    status = 'Success';
    explorerLink = `https://testnet.pharosscan.xyz/tx/${receipt.hash}`;
    logger.success(`Wrap ${index + 1} completed: ${receipt.hash}`);
    logger.step(`Explorer: ${explorerLink}`);

    await verifyTask(wallet, proxy, jwt, receipt.hash);
    return { walletAddress: wallet.address, action: `Wrap PHRS`, status, txHash, explorerLink };
  } catch (error) {
    logger.error(`Wrap ${index + 1} failed: ${error.message}`);
    if (error.transaction) {
      logger.error(`Transaction details: ${JSON.stringify(error.transaction, null, 2)}`);
    }
    if (error.receipt) {
      logger.error(`Receipt: ${JSON.stringify(error.receipt, null, 2)}`);
    }
    return { walletAddress: wallet.address, action: `Wrap PHRS`, status, txHash, explorerLink };
  }
};

// Function to claim daily faucet
const claimFaucet = async (wallet, proxy = null) => {
  try {
    logger.step(`Checking faucet eligibility for wallet: ${wallet.address}`);

    const message = "pharos";
    const signature = await wallet.signMessage(message);
    logger.step(`Signed message: ${signature}`);

    const loginUrl = `https://api.pharosnetwork.xyz/user/login?address=${wallet.address}&signature=${signature}&invite_code=8G8MJ3zGE5B7tJgP`;
    const headers = {
      accept: "application/json, text/plain, */*",
      "accept-language": "en-US,en;q=0.8",
      authorization: "Bearer null",
      "sec-ch-ua": '"Chromium";v="136", "Brave";v="136", "Not.A/Brand";v="99"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      "sec-gpc": "1",
      Referer: "https://testnet.pharosnetwork.xyz/",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "User-Agent": randomUseragent.getRandom(),
    };

    const axiosConfig = {
      method: 'post',
      url: loginUrl,
      headers,
      httpsAgent: proxy ? new HttpsProxyAgent(proxy) : null,
    };

    logger.loading('Sending login request for faucet...');
    const loginResponse = await axios(axiosConfig);
    const loginData = loginResponse.data;

    if (loginData.code !== 0 || !loginData.data.jwt) {
      logger.error(`Login failed for faucet: ${loginData.msg || 'Unknown error'}`);
      return false;
    }

    const jwt = loginData.data.jwt;
    logger.success(`Login successful for faucet, JWT: ${jwt}`);

    const statusUrl = `https://api.pharosnetwork.xyz/faucet/status?address=${wallet.address}`;
    const statusHeaders = {
      ...headers,
      authorization: `Bearer ${jwt}`,
    };

    logger.loading('Checking faucet status...');
    const statusResponse = await axios({
      method: 'get',
      url: statusUrl,
      headers: statusHeaders,
      httpsAgent: proxy ? new HttpsProxyAgent(proxy) : null,
    });
    const statusData = statusResponse.data;

    if (statusData.code !== 0 || !statusData.data) {
      logger.error(`Faucet status check failed: ${statusData.msg || 'Unknown error'}`);
      return false;
    }

    if (!statusData.data.is_able_to_faucet) {
      const nextAvailable = new Date(statusData.data.avaliable_timestamp * 1000).toLocaleString('en-US', { timeZone: 'Asia/Makassar' });
      logger.warn(`Faucet not available until: ${nextAvailable}`);
      return false;
    }

    const claimUrl = `https://api.pharosnetwork.xyz/faucet/daily?address=${wallet.address}`;
    logger.loading('Claiming faucet...');
    const claimResponse = await axios({
      method: 'post',
      url: claimUrl,
      headers: statusHeaders,
      httpsAgent: proxy ? new HttpsProxyAgent(proxy) : null,
    });
    const claimData = claimResponse.data;

    if (claimData.code === 0) {
      logger.success(`Faucet claimed successfully for ${wallet.address}`);
      return true;
    } else {
      logger.error(`Faucet claim failed: ${claimData.msg || 'Unknown error'}`);
      return false;
    }
  } catch (error) {
    logger.error(`Faucet claim failed for ${wallet.address}: ${error.message}`);
    return false;
  }
};

// Function to perform daily check-in
const performCheckIn = async (wallet, proxy = null) => {
  try {
    logger.step(`Performing daily check-in for wallet: ${wallet.address}`);

    const message = "pharos";
    const signature = await wallet.signMessage(message);
    logger.step(`Signed message: ${signature}`);

    const loginUrl = `https://api.pharosnetwork.xyz/user/login?address=${wallet.address}&signature=${signature}&invite_code=8G8MJ3zGE5B7tJgP`;
    const headers = {
      accept: "application/json, text/plain, */*",
      "accept-language": "en-US,en;q=0.8",
      authorization: "Bearer null",
      "sec-ch-ua": '"Chromium";v="136", "Brave";v="136", "Not.A/Brand";v="99"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      "sec-gpc": "1",
      Referer: "https://testnet.pharosnetwork.xyz/",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "User-Agent": randomUseragent.getRandom(),
    };

    const axiosConfig = {
      method: 'post',
      url: loginUrl,
      headers,
      httpsAgent: proxy ? new HttpsProxyAgent(proxy) : null,
    };

    logger.loading('Sending login request...');
    const loginResponse = await axios(axiosConfig);
    const loginData = loginResponse.data;

    if (loginData.code !== 0 || !loginData.data.jwt) {
      logger.error(`Login failed: ${loginData.msg || 'Unknown error'}`);
      return null;
    }

    const jwt = loginData.data.jwt;
    logger.success(`Login successful, JWT: ${jwt}`);

    const checkInUrl = `https://api.pharosnetwork.xyz/sign/in?address=${wallet.address}`;
    const checkInHeaders = {
      ...headers,
      authorization: `Bearer ${jwt}`,
    };

    logger.loading('Sending check-in request...');
    const checkInResponse = await axios({
      method: 'post',
      url: checkInUrl,
      headers: checkInHeaders,
      httpsAgent: proxy ? new HttpsProxyAgent(proxy) : null,
    });
    const checkInData = checkInResponse.data;

    if (checkInData.code === 0) {
      logger.success(`Check-in successful for ${wallet.address}`);
      return jwt;
    } else {
      logger.warn(`Check-in failed, possibly already checked in: ${checkInData.msg || 'Unknown error'}`);
      return jwt;
    }
  } catch (error) {
    logger.error(`Check-in failed for ${wallet.address}: ${error.message}`);
    return null;
  }
};

// Function to add liquidity to a pool
const addLiquidity = async (wallet, provider, index, jwt, proxy) => {
  let txHash = 'N/A';
  let status = 'Failed';
  let explorerLink = 'N/A';
  // Initialize pairDescription robustly, in case pair assignment itself fails
  let pairDescription = `Add LP (Index ${index + 1})`; 

  try {
    const pair = lpOptions[Math.floor(Math.random() * lpOptions.length)];
    // Defensive check for 'pair' object.
    if (!pair || typeof pair.token0 === 'undefined' || typeof pair.token1 === 'undefined') {
      throw new Error("Could not select a valid LP pair or pair data is incomplete.");
    }
    pairDescription = `${pair.token0}/${pair.token1}`; // Update description if pair is valid

    const amount0 = pair.amount0;
    const amount1 = pair.amount1;
    logger.step(
      `Preparing Liquidity Add ${index + 1}: ${pairDescription} (${amount0} ${pair.token0}, ${amount1} ${pair.token1})`
    );

    const decimals0 = tokenDecimals[pair.token0];
    const amount0Wei = ethers.parseUnits(amount0.toString(), decimals0);
    if (!(await checkBalanceAndApproval(wallet, tokens[pair.token0], amount0, decimals0, tokens.POSITION_MANAGER))) {
      return { walletAddress: wallet.address, action: `Add LP ${pairDescription}`, status: 'Approval Failed', txHash, explorerLink };
    }

    const decimals1 = tokenDecimals[pair.token1];
    const amount1Wei = ethers.parseUnits(amount1.toString(), decimals1);
    if (!(await checkBalanceAndApproval(wallet, tokens[pair.token1], amount1, decimals1, tokens.POSITION_MANAGER))) {
      return { walletAddress: wallet.address, action: `Add LP ${pairDescription}`, status: 'Approval Failed', txHash, explorerLink };
    }

    const positionManager = new ethers.Contract(tokens.POSITION_MANAGER, positionManagerAbi, wallet);

    const deadline = Math.floor(Date.now() / 1000) + 600;
    const tickLower = -60000; // Example tick range
    const tickUpper = 60000; // Example tick range

    const mintParams = {
      token0: tokens[pair.token0],
      token1: tokens[pair.token1],
      fee: pair.fee,
      tickLower,
      tickUpper,
      amount0Desired: amount0Wei,
      amount1Desired: amount1Wei,
      amount0Min: 0,
      amount1Min: 0,
      recipient: wallet.address,
      deadline,
    };

    let estimatedGas;
    try {
      estimatedGas = await positionManager.mint.estimateGas(mintParams, { from: wallet.address });
    } catch (error) {
      logger.error(`Gas estimation failed for LP ${index + 1}: ${error.message}`);
      return { walletAddress: wallet.address, action: `Add LP ${pairDescription}`, status: 'Gas Estimation Failed', txHash, explorerLink };
    }

    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || ethers.parseUnits('1', 'gwei');

    const tx = await positionManager.mint(mintParams, {
      gasLimit: Math.ceil(Number(estimatedGas) * 1.2),
      gasPrice,
      maxFeePerGas: feeData.maxFeePerGas || undefined,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || undefined,
    });

    logger.loading(`Liquidity Add ${index + 1} sent, waiting for confirmation...`);
    const receipt = await waitForTransactionWithRetry(provider, tx.hash);
    
    txHash = receipt.hash;
    status = 'Success';
    explorerLink = `https://testnet.pharosscan.xyz/tx/${receipt.hash}`;
    logger.success(`Liquidity Add ${index + 1} completed: ${receipt.hash}`);
    logger.step(`Explorer: ${explorerLink}`);

    await verifyTask(wallet, proxy, jwt, receipt.hash);
    return { walletAddress: wallet.address, action: `Add LP ${pairDescription}`, status, txHash, explorerLink };
  } catch (error) {
    logger.error(`Liquidity Add ${index + 1} failed: ${error.message}`);
    if (error.transaction) {
      logger.error(`Transaction details: ${JSON.stringify(error.transaction, null, 2)}`);
    }
    if (error.receipt) {
      logger.error(`Receipt: ${JSON.stringify(error.receipt, null, 2)}`);
    }
    return { walletAddress: wallet.address, action: `Add LP ${pairDescription}`, status, txHash, explorerLink };
  }
};

// Function to get user-defined delay for cycles
const getUserDelay = () => {
  let delayMinutes = process.env.DELAY_MINUTES;
  if (!delayMinutes) {
    delayMinutes = prompt('Enter delay between cycles in minutes (e.g., 30): ');
  }
  const minutes = parseInt(delayMinutes, 10);
  if (isNaN(minutes) || minutes <= 0) {
    logger.error('Invalid delay input, using default 30 minutes');
    return 30;
  }
  return minutes;
};

// Function for a simple countdown timer
const countdown = async (minutes) => {
  const totalSeconds = minutes * 60;
  logger.info(`Starting ${minutes}-minute countdown...`);

  for (let seconds = totalSeconds; seconds >= 0; seconds--) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    process.stdout.write(`\r${colors.cyan}Time remaining: ${mins}m ${secs}s${colors.reset} `);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  process.stdout.write('\rCountdown complete! Restarting process...\n');
};

/**
 * Displays transaction results in a formatted, colorful ASCII table.
 * @param {Array<Object>} transactions - An array of transaction objects.
 * @param {string} title - The title for the transaction table.
 */
const displayTransactionTable = (transactions, title = 'Transaction Results') => {
  if (!transactions || transactions.length === 0) {
    logger.info(`No transactions to display for "${title}".`);
    return;
  }

  console.log(`\n${colors.bold}${colors.blue}=== ${title} ===${colors.reset}`);

  const headers = ['Wallet Address', 'Action', 'Status', 'Tx Hash (Partial)', 'Explorer Link'];
  
  // Calculate initial column widths based on headers
  const columnWidths = headers.map(header => header.length);

  // Adjust column widths based on content
  transactions.forEach(tx => {
    columnWidths[0] = Math.max(columnWidths[0], tx.walletAddress.length); // Full address length
    columnWidths[1] = Math.max(columnWidths[1], tx.action.length);
    columnWidths[2] = Math.max(columnWidths[2], tx.status.length);
    // For Tx Hash, consider the truncated length plus ellipsis
    columnWidths[3] = Math.max(columnWidths[3], tx.txHash && tx.txHash !== 'N/A' ? 14 : 'N/A'.length); // 6 (prefix) + 3 (ellipsis) + 4 (suffix) = 13, min 14
    columnWidths[4] = Math.max(columnWidths[4], tx.explorerLink && tx.explorerLink !== 'N/A' ? 'View'.length : 'N/A'.length);
  });

  // Create the table border
  const border = '+' + columnWidths.map(w => '-'.repeat(w + 2)).join('+') + '+';
  
  // Create the header row
  const headerLine = '|' + headers.map((h, i) => `${colors.bold}${colors.white} ${h.padEnd(columnWidths[i])} ${colors.reset}`).join('|') + '|';

  console.log(border);
  console.log(headerLine);
  console.log(border);

  // Populate table with transaction data
  transactions.forEach(tx => {
    const statusColor = tx.status === 'Success' ? colors.green : (tx.status === 'Skipped' ? colors.yellow : colors.red);
    const txHashDisplay = tx.txHash && tx.txHash !== 'N/A' ? `${tx.txHash.substring(0, 6)}...${tx.txHash.substring(tx.txHash.length - 4)}` : 'N/A';
    const explorerLinkDisplay = tx.explorerLink && tx.explorerLink !== 'N/A' ? 'View' : 'N/A';

    const row =
      `| ${tx.walletAddress.substring(0, 10)}...${tx.walletAddress.substring(tx.walletAddress.length - 8).padEnd(columnWidths[0] - 13)} ` +
      `| ${tx.action.padEnd(columnWidths[1])} ` +
      `| ${statusColor}${tx.status.padEnd(columnWidths[2])}${colors.reset} ` +
      `| ${txHashDisplay.padEnd(columnWidths[3])} ` +
      `| ${explorerLinkDisplay.padEnd(columnWidths[4])} |`;
    console.log(row);
  });
  console.log(border);
  console.log(`${colors.bold}${colors.blue}=== End of ${title} ===${colors.reset}\n`);
};


// Main function to run the bot
const main = async () => {
  logger.banner();

  const delayMinutes = getUserDelay();
  logger.info(`Delay between cycles set to ${delayMinutes} minutes`);

  const proxies = loadProxies();
  // Filter out any undefined or null private keys
  const privateKeys = [
    process.env.PRIVATE_KEY_1, process.env.PRIVATE_KEY_2, process.env.PRIVATE_KEY_3,
    process.env.PRIVATE_KEY_4, process.env.PRIVATE_KEY_5, process.env.PRIVATE_KEY_6,
    process.env.PRIVATE_KEY_7, process.env.PRIVATE_KEY_8, process.env.PRIVATE_KEY_9,
    process.env.PRIVATE_KEY_10, process.env.PRIVATE_KEY_11, process.env.PRIVATE_KEY_12,
    process.env.PRIVATE_KEY_13, process.env.PRIVATE_KEY_14, process.env.PRIVATE_KEY_15,
    process.env.PRIVATE_KEY_16, process.env.PRIVATE_KEY_17, process.env.PRIVATE_KEY_18,
    process.env.PRIVATE_KEY_19, process.env.PRIVATE_KEY_20
  ].filter(pk => pk); // Filters out any empty or undefined elements

  if (!privateKeys.length) {
    logger.error('No private keys found in .env. Please ensure PRIVATE_KEY_1 to PRIVATE_KEY_20 are set.');
    return;
  }

  const numTransfers = 2; // Example: Set to 2 transfers per wallet
  const numWraps = 2;     // Example: Set to 2 wraps per wallet
  const numSwaps = 2;     // Example: Set to 2 swaps per wallet
  const numLPs = 1;       // Example: Set to 1 LP addition per wallet

  while (true) {
    const allTransactionResults = []; // Array to store results for all wallets in the current cycle

    for (const privateKey of privateKeys) {
      const proxy = proxies.length ? getRandomProxy(proxies) : null;
      const provider = setupProvider(proxy);
      const wallet = new ethers.Wallet(privateKey, provider);

      logger.wallet(`Using wallet: ${wallet.address}`);

      // Faucet and Check-in are logged immediately and don't directly contribute to the transaction table
      await claimFaucet(wallet, proxy);
      const jwt = await performCheckIn(wallet, proxy);
      if (jwt) {
        await getUserInfo(wallet, proxy, jwt);
      } else {
        logger.error('Skipping user info fetch due to failed check-in');
      }

      console.log(`\n${colors.cyan}------------------------${colors.reset}`);
      console.log(`${colors.cyan}PERFORMING TRANSACTIONS FOR WALLET: ${wallet.address.substring(0, 10)}...${wallet.address.substring(wallet.address.length - 8)}${colors.reset}`);
      console.log(`${colors.cyan}------------------------${colors.reset}`);

      // Execute and record each type of transaction
      for (let i = 0; i < numTransfers; i++) {
        const result = await transferPHRS(wallet, provider, i, jwt, proxy);
        allTransactionResults.push(result);
        await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000)); // Random delay
      }

      for (let i = 0; i < numWraps; i++) {
        const result = await wrapPHRS(wallet, provider, i, jwt, proxy);
        allTransactionResults.push(result);
        await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000)); // Random delay
      }

      for (let i = 0; i < numSwaps; i++) {
        const result = await performSwap(wallet, provider, i, jwt, proxy);
        allTransactionResults.push(result);
        await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000)); // Random delay
      }

      for (let i = 0; i < numLPs; i++) {
        const result = await addLiquidity(wallet, provider, i, jwt, proxy);
        allTransactionResults.push(result);
        await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000)); // Random delay
      }
    }

    logger.success('All actions completed for all wallets in this cycle!');
    // Display the summary table for all transactions performed in this cycle
    displayTransactionTable(allTransactionResults, 'Summary of All Transactions in Cycle');

    await countdown(delayMinutes); // Start countdown for the next cycle
  }
};

// Start the main bot function
main().catch(error => {
  logger.error(`Bot crashed: ${error.message}`);
});

// --- Start of Demonstration for your provided log snippet ---
// This block is for demonstration purposes only and does not interfere with the main bot logic.
// It shows how the provided log output would appear if processed into the rich table format.
(async () => {
  console.log(`\n${colors.bold}${colors.blue}=== DEMONSTRATION: YOUR LOG SNIPPET IN TABLE FORMAT ===${colors.reset}`);
  console.log(`   (Note: Wallet Address is a placeholder as it's not present in the original log snippet)`);
  
  const sampleTransactions = [
    {
      walletAddress: '0x123...DemoWallet...abc', // Placeholder wallet address
      action: 'Approval for 0x1a4d...',
      status: 'Failed',
      txHash: '0xe44fd660ef4f5c9020f4b620f01e7837f45c3229263ccdc5bd32f794d02d7e17',
      explorerLink: 'https://testnet.pharosscan.xyz/tx/0xe44fd660ef4f5c9020f4b620f01e7837f45c3229263ccdc5bd32f794d02d7e17',
    },
    {
      walletAddress: '0x123...DemoWallet...abc',
      action: 'Swap USDT -> USDC',
      status: 'Success',
      txHash: '0xa69e868599d9c0e8cbc6b12f6ec9479cb2a57a155962a11105c1024ea5b9ae57',
      explorerLink: 'https://testnet.pharosscan.xyz/tx/0xa69e868599d9c0e8cbc6b12f6ec9479cb2a57a155962a11105c1024ea5b9ae57',
    },
    {
      walletAddress: '0x123...DemoWallet...abc',
      action: 'Swap WPHRS -> USDC',
      status: 'Failed',
      txHash: 'N/A', // No transaction hash provided for this specific failure in the log
      explorerLink: 'N/A',
    },
    {
      walletAddress: '0x123...DemoWallet...abc',
      action: 'Swap USDT -> WPHRS',
      status: 'Failed',
      txHash: '0x255da7ef811aa109d451445120ebe5f0d80c94b3093324096c939b563e113b72',
      explorerLink: 'https://testnet.pharosscan.xyz/tx/0x255da7ef811aa109d451445120ebe5f0d80c94b3093324096c939b563e113b72',
    },
  ];

  displayTransactionTable(sampleTransactions, 'Simulated Transaction Logs');
})();
// --- End of Demonstration ---
