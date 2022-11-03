/* eslint-disable no-console */
import {
  Callbacks,
  EndpointOptions,
  SessionOptions,
  Wallet,
} from '@cosmos-kit/core';
import { MainWalletBase } from '@cosmos-kit/core';
import { KeplrWalletConnectV1 } from '@keplr-wallet/wc-client';
import WalletConnect from '@walletconnect/client';
import EventEmitter from 'events';

import { KeplrClient } from '../client';
import { ChainKeplrMobile } from './chain-wallet';
import { getAppUrlFromQrUri } from './utils';

export class KeplrMobileWallet extends MainWalletBase {
  client?: KeplrClient;
  connector: WalletConnect;
  emitter: EventEmitter;

  constructor(walletInfo: Wallet, preferredEndpoints?: EndpointOptions) {
    super(walletInfo, ChainKeplrMobile);
    this.preferredEndpoints = preferredEndpoints;

    this.connector = new WalletConnect({
      bridge: 'https://bridge.walletconnect.org',
    });

    this.connector.on('connect', (error) => {
      if (error) {
        throw error;
      }
      this.client = new KeplrClient(
        new KeplrWalletConnectV1(this.connector),
        this.walletInfo.mode
      );
      this.emitter.emit('update');
    });

    this.connector.on('disconnect', (error) => {
      if (error) {
        throw error;
      }
      this.emitter.emit('disconnect');
    });

    this.client = new KeplrClient(
      new KeplrWalletConnectV1(this.connector),
      this.walletInfo.mode
    );
    this.emitter = new EventEmitter();
  }

  protected setChainsCallback(): void {
    this.chainWallets.forEach((chainWallet: ChainKeplrMobile) => {
      chainWallet.client = this.client;
      chainWallet.connector = this.connector;
      chainWallet.emitter = this.emitter;
      chainWallet.connect = this.connect;
      chainWallet.disconnect = this.disconnect;
    });
  }

  get qrUri() {
    return this.connector.uri;
  }

  get appUrl() {
    return getAppUrlFromQrUri(this.qrUri);
  }

  async connect(
    sessionOptions?: SessionOptions,
    callbacks?: Callbacks
  ): Promise<void> {
    if (!this.connector.connected) {
      await this.connector.createSession();

      this.emitter.on('update', async () => {
        await this.update(callbacks);
        if (sessionOptions?.duration) {
          setTimeout(async () => {
            await this.disconnect(callbacks);
            await this.connect(sessionOptions);
          }, sessionOptions?.duration);
        }
        callbacks?.connect?.();
      });
      this.emitter.on('disconnect', async () => {
        await this.disconnect(callbacks);
      });
    } else {
      console.info('Using existing wallet connect session.');
      await this.update(callbacks);
    }
  }

  async fetchClient() {
    return this.client;
  }

  async disconnect(callbacks?: Callbacks) {
    if (this.connector.connected) {
      await this.connector.killSession();
    }
    this.reset();
    callbacks?.disconnect?.();
    this.emitter.removeAllListeners();
  }
}