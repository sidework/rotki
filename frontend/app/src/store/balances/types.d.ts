import { BigNumber } from 'bignumber.js';
import {
  BtcBalances,
  EthBalances,
  ManualBalanceWithValue,
  SupportedExchange
} from '@/services/balances/types';
import {
  Balance,
  BtcAccountData,
  GeneralAccountData,
  HasBalance
} from '@/services/types-api';
import { SupportedAsset } from '@/services/types-model';
import {
  Blockchain,
  ExchangeData,
  GeneralAccount,
  UsdToFiatExchangeRates
} from '@/typing/types';

export interface LocationBalance {
  readonly location: string;
  readonly usdValue: BigNumber;
}

export interface ManualBalanceByLocation {
  [location: string]: BigNumber;
}

export interface AssetBalances {
  readonly [asset: string]: Balance;
}

export interface BalanceState {
  eth: EthBalances;
  btc: BtcBalances;
  totals: AssetBalances;
  usdToFiatExchangeRates: UsdToFiatExchangeRates;
  connectedExchanges: SupportedExchange[];
  exchangeBalances: ExchangeData;
  ethAccounts: GeneralAccountData[];
  btcAccounts: BtcAccountData;
  supportedAssets: SupportedAsset[];
  manualBalances: ManualBalanceWithValue[];
  manualBalanceByLocation: ManualBalanceByLocation;
}

export interface ExchangePayload {
  readonly exchange: string;
  readonly apiKey: string;
  readonly apiSecret: string;
  readonly passphrase: string | null;
}

interface XpubPayload {
  readonly xpub: string;
  readonly derivationPath: string;
}

export interface BlockchainAccountPayload extends AccountPayload {
  readonly blockchain: Blockchain;
  readonly xpub?: XpubPayload;
}

export interface AccountPayload {
  readonly address: string;
  readonly label?: string;
  readonly tags: string[];
}

export interface ExchangeBalancePayload {
  readonly name: string;
  readonly ignoreCache: boolean;
}

export interface BlockchainBalancePayload {
  readonly blockchain?: Blockchain;
  readonly ignoreCache: boolean;
}

export interface AllBalancePayload {
  readonly ignoreCache: boolean;
  readonly saveData: boolean;
}

export interface AccountWithBalance extends GeneralAccount, HasBalance {}

interface XpubAccount extends GeneralAccount, XpubPayload {}

interface XpubAccountWithBalance extends XpubAccount, HasBalance {}

export type BlockchainAccount = GeneralAccount | XpubAccount;

export type BlockchainAccountWithBalance =
  | XpubAccountWithBalance
  | AccountWithBalance;

export interface AssetBalance {
  readonly asset: string;
  readonly amount: BigNumber;
  readonly usdValue: BigNumber;
}

export type AddAccountsPayload = {
  readonly blockchain: Blockchain;
  readonly payload: AccountPayload[];
};

export interface BlockchainTotal {
  readonly chain: Blockchain;
  readonly usdValue: BigNumber;
}
