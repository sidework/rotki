import axios, { AxiosInstance } from 'axios';
import {
  AccountState,
  DBSettings,
  ExternalServiceKeys
} from '@/model/action-result';
import {
  axiosCamelCaseTransformer,
  axiosSnakeCaseTransformer,
  setupTransformer
} from '@/services/axios-tranformers';
import { BalancesApi } from '@/services/balances/balances-api';
import { basicAxiosTransformer } from '@/services/consts';
import { DefiApi } from '@/services/defi/defi-api';
import { HistoryApi } from '@/services/history/history-api';
import { SessionApi } from '@/services/session/session-api';
import {
  ActionResult,
  AsyncQuery,
  BtcAccountData,
  DBAssetBalance,
  GeneralAccountData,
  LocationData,
  Messages,
  NetvalueDataResult,
  PendingTask,
  PeriodicClientQueryResult,
  SingleAssetBalance,
  SupportedAssets,
  SyncAction,
  TaskNotFoundError,
  VersionCheck
} from '@/services/types-api';
import {
  validWithSessionAndExternalService,
  handleResponse,
  validWithParamsSessionAndExternalService,
  validStatus,
  validAccountOperationStatus,
  validWithoutSessionStatus,
  validWithSessionStatus,
  validAuthorizedStatus,
  validTaskStatus
} from '@/services/utils';
import {
  AccountPayload,
  BlockchainAccountPayload,
  XpubPayload
} from '@/store/balances/types';
import {
  AccountSession,
  Blockchain,
  ExternalServiceKey,
  ExternalServiceName,
  FiatExchangeRates,
  SettingsUpdate,
  SyncApproval,
  SyncConflictError,
  Tag,
  Tags,
  TaskResult,
  UnlockPayload
} from '@/typing/types';

export class RotkehlchenApi {
  private axios: AxiosInstance;
  private _defi: DefiApi;
  private _session: SessionApi;
  private _balances: BalancesApi;
  private _history: HistoryApi;

  constructor() {
    this.axios = axios.create({
      baseURL: `${process.env.VUE_APP_BACKEND_URL}/api/1/`,
      timeout: 30000
    });
    this._defi = new DefiApi(this.axios);
    this._session = new SessionApi(this.axios);
    this._balances = new BalancesApi(this.axios);
    this._history = new HistoryApi(this.axios);
  }

  get defi(): DefiApi {
    return this._defi;
  }

  get session(): SessionApi {
    return this._session;
  }

  get balances(): BalancesApi {
    return this._balances;
  }

  get history(): HistoryApi {
    return this._history;
  }

  setup(serverUrl: string) {
    this.axios = axios.create({
      baseURL: `${serverUrl}/api/1/`,
      timeout: 30000
    });
    this._defi = new DefiApi(this.axios);
    this._session = new SessionApi(this.axios);
    this._balances = new BalancesApi(this.axios);
    this._history = new HistoryApi(this.axios);
  }

  checkIfLogged(username: string): Promise<boolean> {
    return this.axios
      .get<ActionResult<AccountSession>>(`/users`)
      .then(handleResponse)
      .then(result => result[username] === 'loggedin');
  }

  logout(username: string): Promise<boolean> {
    return this.axios
      .patch<ActionResult<boolean>>(
        `/users/${username}`,
        {
          action: 'logout'
        },
        { validateStatus: validAccountOperationStatus }
      )
      .then(handleResponse);
  }

  queryPeriodicData(): Promise<PeriodicClientQueryResult> {
    return this.axios
      .get<ActionResult<PeriodicClientQueryResult>>('/periodic/', {
        validateStatus: validWithSessionStatus,
        transformResponse: basicAxiosTransformer
      })
      .then(handleResponse);
  }

  setPremiumCredentials(
    username: string,
    apiKey: string,
    apiSecret: string
  ): Promise<boolean> {
    return this.axios
      .patch<ActionResult<boolean>>(
        `/users/${username}`,
        {
          premium_api_key: apiKey,
          premium_api_secret: apiSecret
        },
        { validateStatus: validAuthorizedStatus }
      )
      .then(handleResponse);
  }

  deletePremiumCredentials(): Promise<boolean> {
    return this.axios
      .delete<ActionResult<boolean>>('/premium', {
        validateStatus: validStatus
      })
      .then(handleResponse);
  }

  changeUserPassword(
    username: string,
    currentPassword: string,
    newPassword: string
  ): Promise<boolean> {
    return this.axios
      .patch<ActionResult<boolean>>(
        `/users/${username}/password`,
        {
          name: username,
          current_password: currentPassword,
          new_password: newPassword
        },
        {
          validateStatus: validAuthorizedStatus
        }
      )
      .then(handleResponse);
  }

  ignoredAssets(): Promise<string[]> {
    return this.axios
      .get<ActionResult<string[]>>('/assets/ignored', {
        validateStatus: validStatus
      })
      .then(handleResponse);
  }

  async ping(): Promise<AsyncQuery> {
    return this.axios
      .get<ActionResult<AsyncQuery>>('/ping') // no validate status here since defaults work
      .then(handleResponse);
  }

  checkVersion(): Promise<VersionCheck> {
    return this.axios
      .get<ActionResult<VersionCheck>>('/version')
      .then(handleResponse);
  }

  setSettings(settings: SettingsUpdate): Promise<DBSettings> {
    return this.axios
      .put<ActionResult<DBSettings>>(
        '/settings',
        {
          settings: settings
        },
        {
          validateStatus: validStatus
        }
      )
      .then(handleResponse);
  }

  queryExchangeBalances(
    name: string,
    ignoreCache: boolean = false
  ): Promise<PendingTask> {
    return this.axios
      .get<ActionResult<PendingTask>>(`/exchanges/balances/${name}`, {
        params: axiosSnakeCaseTransformer({
          asyncQuery: true,
          ignoreCache: ignoreCache ? true : undefined
        }),
        validateStatus: validStatus,
        transformResponse: basicAxiosTransformer
      })
      .then(handleResponse);
  }

  queryBalancesAsync(
    ignoreCache: boolean = false,
    saveData: boolean = false
  ): Promise<AsyncQuery> {
    return this.axios
      .get<ActionResult<AsyncQuery>>('/balances/', {
        params: {
          async_query: true,
          ignore_cache: ignoreCache ? true : undefined,
          save_data: saveData ? true : undefined
        },
        validateStatus: validStatus
      })
      .then(handleResponse);
  }

  queryTaskResult<T>(
    id: number,
    numericKeys?: string[]
  ): Promise<ActionResult<T>> {
    const transformer = numericKeys
      ? setupTransformer(numericKeys)
      : this.axios.defaults.transformResponse;

    return this.axios
      .get<ActionResult<TaskResult<ActionResult<T>>>>(`/tasks/${id}`, {
        validateStatus: validTaskStatus,
        transformResponse: transformer
      })
      .then(response => {
        if (response.status === 404) {
          throw new TaskNotFoundError(`Task with id ${id} not found`);
        }
        return response;
      })
      .then(handleResponse)
      .then(value => {
        if (value.outcome) {
          return value.outcome;
        }
        throw new Error('No result');
      });
  }

  queryNetvalueData(): Promise<NetvalueDataResult> {
    return this.axios
      .get<ActionResult<NetvalueDataResult>>('/statistics/netvalue', {
        validateStatus: validStatus
      })
      .then(handleResponse);
  }

  queryOwnedAssets(): Promise<string[]> {
    return this.axios
      .get<ActionResult<string[]>>('/assets', {
        validateStatus: validStatus
      })
      .then(handleResponse);
  }

  queryTimedBalancesData(
    asset: string,
    start_ts: number,
    end_ts: number
  ): Promise<SingleAssetBalance[]> {
    return this.axios
      .get<ActionResult<SingleAssetBalance[]>>(`/statistics/balance/${asset}`, {
        params: {
          from_timestamp: start_ts,
          to_timestamp: end_ts
        },
        validateStatus: validStatus
      })
      .then(handleResponse);
  }

  queryLatestLocationValueDistribution(): Promise<LocationData[]> {
    return this.axios
      .get<ActionResult<LocationData[]>>('/statistics/value_distribution', {
        params: { distribution_by: 'location' },
        validateStatus: validStatus
      })
      .then(handleResponse);
  }

  queryLatestAssetValueDistribution(): Promise<DBAssetBalance[]> {
    return this.axios
      .get<ActionResult<DBAssetBalance[]>>('/statistics/value_distribution', {
        params: { distribution_by: 'asset' },
        validateStatus: validStatus
      })
      .then(handleResponse);
  }

  queryStatisticsRenderer(): Promise<string> {
    return this.axios
      .get<ActionResult<string>>('/statistics/renderer', {
        validateStatus: validStatus
      })
      .then(handleResponse);
  }

  processTradeHistoryAsync(
    start_ts: number,
    end_ts: number
  ): Promise<AsyncQuery> {
    return this.axios
      .get<ActionResult<AsyncQuery>>('/history/', {
        params: {
          async_query: true,
          from_timestamp: start_ts,
          to_timestamp: end_ts
        },
        validateStatus: validStatus
      })
      .then(handleResponse);
  }

  getFiatExchangeRates(currencies: string[]): Promise<FiatExchangeRates> {
    return this.axios
      .get<ActionResult<FiatExchangeRates>>('/fiat_exchange_rates', {
        params: {
          currencies: currencies.join(',')
        },
        validateStatus: validWithoutSessionStatus
      })
      .then(handleResponse);
  }

  unlockUser(payload: UnlockPayload): Promise<AccountState> {
    const {
      create,
      username,
      password,
      apiKey,
      apiSecret,
      syncApproval,
      submitUsageAnalytics
    } = payload;
    if (create) {
      return this.registerUser(
        username,
        password,
        apiKey,
        apiSecret,
        submitUsageAnalytics !== undefined
          ? { submit_usage_analytics: submitUsageAnalytics }
          : undefined
      );
    }
    return this.login(username, password, syncApproval);
  }

  registerUser(
    name: string,
    password: string,
    apiKey?: string,
    apiSecret?: string,
    initialSettings?: SettingsUpdate
  ): Promise<AccountState> {
    return this.axios
      .put<ActionResult<AccountState>>(
        '/users',
        {
          name,
          password,
          premium_api_key: apiKey,
          premium_api_secret: apiSecret,
          initial_settings: initialSettings
        },
        {
          validateStatus: validStatus
        }
      )
      .then(handleResponse);
  }

  login(
    name: string,
    password: string,
    syncApproval: SyncApproval = 'unknown'
  ): Promise<AccountState> {
    return this.axios
      .patch<ActionResult<AccountState>>(
        `/users/${name}`,
        {
          action: 'login',
          password,
          sync_approval: syncApproval
        },
        { validateStatus: validAccountOperationStatus }
      )
      .then(response => {
        if (response.status === 300) {
          throw new SyncConflictError(
            response.data.message,
            axiosCamelCaseTransformer(response.data.result)
          );
        }
        return response;
      })
      .then(handleResponse);
  }

  removeExchange(name: string): Promise<boolean> {
    return this.axios
      .delete<ActionResult<boolean>>('/exchanges', {
        data: {
          name
        },
        validateStatus: validStatus
      })
      .then(handleResponse);
  }

  importDataFrom(source: string, filepath: string): Promise<boolean> {
    return this.axios
      .put<ActionResult<boolean>>(
        '/import',
        {
          source,
          filepath
        },
        {
          validateStatus: validStatus
        }
      )
      .then(handleResponse);
  }

  removeBlockchainAccount(
    blockchain: string,
    account: string
  ): Promise<PendingTask> {
    return this.axios
      .delete<ActionResult<PendingTask>>(`/blockchains/${blockchain}`, {
        data: axiosSnakeCaseTransformer({
          asyncQuery: true,
          accounts: [account]
        }),
        validateStatus: validWithParamsSessionAndExternalService,
        transformResponse: basicAxiosTransformer
      })
      .then(handleResponse);
  }

  addBlockchainAccount({
    address,
    blockchain,
    label,
    tags,
    xpub
  }: BlockchainAccountPayload): Promise<PendingTask> {
    const url = xpub
      ? `/blockchains/${blockchain}/xpub`
      : `/blockchains/${blockchain}`;

    const basePayload = {
      label,
      tags
    };

    const payload = xpub
      ? {
          xpub: xpub.xpub,
          derivationPath: xpub.derivationPath ? xpub.derivationPath : undefined,
          ...basePayload
        }
      : {
          accounts: [
            {
              address,
              ...basePayload
            }
          ]
        };
    return this.performAsyncQuery(url, payload);
  }

  addBlockchainAccounts(chain: Blockchain, payload: AccountPayload[]) {
    return this.performAsyncQuery(`/blockchains/${chain}`, {
      accounts: payload
    });
  }

  private performAsyncQuery(url: string, payload: any) {
    return this.axios
      .put<ActionResult<PendingTask>>(
        url,
        axiosSnakeCaseTransformer({
          asyncQuery: true,
          ...payload
        }),
        {
          validateStatus: validWithParamsSessionAndExternalService,
          transformResponse: basicAxiosTransformer
        }
      )
      .then(handleResponse);
  }

  async editBtcAccount(
    payload: BlockchainAccountPayload
  ): Promise<BtcAccountData> {
    const { address, label, tags } = payload;
    return this.axios
      .patch<ActionResult<BtcAccountData>>(
        '/blockchains/BTC',
        {
          accounts: [
            {
              address,
              label,
              tags
            }
          ]
        },
        {
          validateStatus: validWithParamsSessionAndExternalService,
          transformResponse: basicAxiosTransformer
        }
      )
      .then(handleResponse);
  }

  async editEthAccount(
    payload: BlockchainAccountPayload
  ): Promise<GeneralAccountData[]> {
    const { address, label, tags } = payload;
    return this.axios
      .patch<ActionResult<GeneralAccountData[]>>(
        '/blockchains/ETH',
        {
          accounts: [
            {
              address,
              label,
              tags
            }
          ]
        },
        {
          validateStatus: validWithParamsSessionAndExternalService,
          transformResponse: basicAxiosTransformer
        }
      )
      .then(handleResponse);
  }

  async deleteXpub({
    derivationPath,
    xpub
  }: XpubPayload): Promise<PendingTask> {
    return this.axios
      .delete<ActionResult<PendingTask>>(`/blockchains/BTC/xpub`, {
        data: axiosSnakeCaseTransformer({
          xpub,
          derivationPath: derivationPath ? derivationPath : undefined,
          asyncQuery: true
        }),
        validateStatus: validWithParamsSessionAndExternalService,
        transformResponse: basicAxiosTransformer
      })
      .then(handleResponse);
  }

  setupExchange(
    name: string,
    api_key: string,
    api_secret: string,
    passphrase: string | null
  ): Promise<boolean> {
    return this.axios
      .put<ActionResult<boolean>>(
        '/exchanges',
        {
          name,
          api_key,
          api_secret,
          passphrase
        },
        {
          validateStatus: validStatus
        }
      )
      .then(handleResponse);
  }

  exportHistoryCSV(directory: string): Promise<boolean> {
    return this.axios
      .get<ActionResult<boolean>>('/history/export/', {
        params: {
          directory_path: directory
        },
        validateStatus: validStatus
      })
      .then(handleResponse);
  }

  modifyAsset(add: boolean, asset: string): Promise<string[]> {
    if (add) {
      return this.addIgnoredAsset(asset);
    }
    return this.removeIgnoredAsset(asset);
  }

  addIgnoredAsset(asset: string): Promise<string[]> {
    return this.axios
      .put<ActionResult<string[]>>(
        '/assets/ignored',
        {
          assets: [asset]
        },
        {
          validateStatus: validStatus
        }
      )
      .then(handleResponse);
  }

  removeIgnoredAsset(asset: string): Promise<string[]> {
    return this.axios
      .delete<ActionResult<string[]>>('/assets/ignored', {
        data: {
          assets: [asset]
        },
        validateStatus: validStatus
      })
      .then(handleResponse);
  }

  consumeMessages(): Promise<Messages> {
    return this.axios
      .get<ActionResult<Messages>>('/messages/')
      .then(handleResponse);
  }

  async getSettings(): Promise<DBSettings> {
    return this.axios
      .get<ActionResult<DBSettings>>('/settings', {
        validateStatus: validWithSessionStatus
      })
      .then(handleResponse);
  }

  async getExchanges(): Promise<string[]> {
    return this.axios
      .get<ActionResult<string[]>>('/exchanges', {
        validateStatus: validWithSessionStatus
      })
      .then(handleResponse);
  }

  queryExternalServices(): Promise<ExternalServiceKeys> {
    return this.axios
      .get<ActionResult<ExternalServiceKeys>>('/external_services/', {
        validateStatus: validWithSessionStatus
      })
      .then(handleResponse);
  }

  async setExternalServices(
    keys: ExternalServiceKey[]
  ): Promise<ExternalServiceKeys> {
    return this.axios
      .put<ActionResult<ExternalServiceKeys>>(
        '/external_services/',
        {
          services: keys
        },
        {
          validateStatus: validStatus
        }
      )
      .then(handleResponse);
  }

  async deleteExternalServices(
    serviceToDelete: ExternalServiceName
  ): Promise<ExternalServiceKeys> {
    return this.axios
      .delete<ActionResult<ExternalServiceKeys>>('/external_services/', {
        data: {
          services: [serviceToDelete]
        },
        validateStatus: validStatus
      })
      .then(handleResponse);
  }

  async getTags(): Promise<Tags> {
    return this.axios
      .get<ActionResult<Tags>>('/tags', {
        validateStatus: validWithSessionStatus
      })
      .then(handleResponse);
  }

  async addTag(tag: Tag): Promise<Tags> {
    return this.axios
      .put<ActionResult<Tags>>(
        '/tags',
        { ...tag },
        {
          validateStatus: validStatus
        }
      )
      .then(handleResponse);
  }

  async editTag(tag: Tag): Promise<Tags> {
    return this.axios
      .patch<ActionResult<Tags>>(
        '/tags',
        { ...tag },
        {
          validateStatus: validStatus
        }
      )
      .then(handleResponse);
  }

  async deleteTag(tagName: string): Promise<Tags> {
    return this.axios
      .delete<ActionResult<Tags>>('/tags', {
        data: {
          name: tagName
        },
        validateStatus: validStatus
      })
      .then(handleResponse);
  }

  async ethAccounts(): Promise<GeneralAccountData[]> {
    return this.axios
      .get<ActionResult<GeneralAccountData[]>>('/blockchains/ETH', {
        validateStatus: validWithSessionStatus,
        transformResponse: basicAxiosTransformer
      })
      .then(handleResponse);
  }

  async btcAccounts(): Promise<BtcAccountData> {
    return this.axios
      .get<ActionResult<BtcAccountData>>('/blockchains/BTC', {
        validateStatus: validWithSessionStatus,
        transformResponse: basicAxiosTransformer
      })
      .then(handleResponse);
  }

  async supportedAssets(): Promise<SupportedAssets> {
    return this.axios
      .get<ActionResult<SupportedAssets>>('assets/all', {
        validateStatus: validWithSessionAndExternalService
      })
      .then(handleResponse);
  }

  async forceSync(action: SyncAction): Promise<PendingTask> {
    return this.axios
      .put<ActionResult<PendingTask>>(
        '/premium/sync',
        axiosSnakeCaseTransformer({ asyncQuery: true, action }),
        {
          validateStatus: validWithParamsSessionAndExternalService,
          transformResponse: basicAxiosTransformer
        }
      )
      .then(handleResponse);
  }
}

export const api = new RotkehlchenApi();
