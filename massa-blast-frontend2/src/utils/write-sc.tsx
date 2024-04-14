import { useState } from 'react';
import {
  Args,
  Client,
  EOperationStatus,
  ICallData,
  MAX_GAS_CALL,
} from '@massalabs/massa-web3';
import { ToastContent, toast } from '@massalabs/react-ui-kit';
import Intl from '../i18n/i18n';

import { OperationToast } from '../components/Toasts/OperationToast';

import { DEFAULT_OP_FEES, SC_ADDRESS } from '../const/sc';
import { logSmartContractEvents } from './massa-utils';

interface ToasterMessage {
  pending: string;
  success: string;
  error: string;
  timeout?: string;
}

function minBigInt(a: bigint, b: bigint) {
  return a < b ? a : b;
}

export const DEPOSIT_STORAGE_COST = 15_800_000n;

export function useWrite(client?: Client) {
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);
  const [opId, setOpId] = useState<string | undefined>(undefined);

  function callSmartContract(
    targetFunction: string,
    parameter: number[],
    messages: ToasterMessage,
    coins = BigInt(0),
  ) {
    if (!client) {
      throw new Error('Massa client not found');
    }
    if (isPending) {
      throw new Error('Operation is already pending');
    }
    setIsSuccess(false);
    setIsError(false);
    setIsPending(false);
    let operationId: string | undefined;
    let toastId: string | undefined;

    const callData = {
      targetAddress: SC_ADDRESS,
      targetFunction,
      parameter,
      coins,
      fee: DEFAULT_OP_FEES,
    } as ICallData;

    client
      .smartContracts()
      .readSmartContract(callData)
      .then((response) => {
        const gasCost = BigInt(response.info.gas_cost);
        return minBigInt(gasCost + (gasCost * 20n) / 100n, MAX_GAS_CALL);
      })
      .then((maxGas: bigint) => {
        callData.maxGas = maxGas;
        return client.smartContracts().callSmartContract(callData);
      })
      .then((opId) => {
        operationId = opId;
        setOpId(opId);
        setIsPending(true);
        toastId = toast.loading(
          (t) => (
            <ToastContent t={t}>
              <OperationToast
                title={messages.pending}
                operationId={operationId}
              />
            </ToastContent>
          ),
          {
            duration: Infinity,
          },
        );
        return client
          .smartContracts()
          .awaitMultipleRequiredOperationStatus(opId, [
            EOperationStatus.SPECULATIVE_ERROR,
            EOperationStatus.FINAL_ERROR,
            EOperationStatus.FINAL_SUCCESS,
          ]);
      })
      .then((status: EOperationStatus) => {
        if (status !== EOperationStatus.FINAL_SUCCESS) {
          throw new Error('Operation failed', { cause: { status } });
        }
        setIsSuccess(true);
        setIsPending(false);
        toast.dismiss(toastId);
        toast.success((t) => (
          <ToastContent t={t}>
            <OperationToast
              title={messages.success}
              operationId={operationId}
            />
          </ToastContent>
        ));
      })
      .catch((error) => {
        console.error(error);
        toast.dismiss(toastId);
        setIsError(true);
        setIsPending(false);

        if (!operationId) {
          console.error('Operation ID not found');
          toast.error((t) => (
            <ToastContent t={t}>
              <OperationToast title={messages.error} />
            </ToastContent>
          ));
          return;
        }

        if (
          [
            EOperationStatus.FINAL_ERROR,
            EOperationStatus.SPECULATIVE_ERROR,
          ].includes(error.cause?.status)
        ) {
          toast.error((t) => (
            <ToastContent t={t}>
              <OperationToast
                title={messages.error}
                operationId={operationId}
              />
            </ToastContent>
          ));
          logSmartContractEvents(client, operationId);
        } else {
          toast.error((t) => (
            <ToastContent t={t}>
              <OperationToast
                title={messages.timeout || Intl.t('steps.failed-timeout')}
                operationId={operationId}
              />
            </ToastContent>
          ));
        }
      });
  }

  function deposit(amount: bigint) {
    callSmartContract(
      'deposit',
      new Args().addU64(amount).serialize(),
      {
        pending: Intl.t('steps.depositing'),
        success: Intl.t('steps.deposit-success'),
        error: Intl.t('steps.deposit-failed'),
      },
      amount + DEPOSIT_STORAGE_COST,
    );
  }

  function requestWithdraw() {
    callSmartContract(
      'requestWithdraw',
      [],
      {
        pending: Intl.t('steps.requesting'),
        success: Intl.t('steps.request-success'),
        error: Intl.t('steps.request-failed'),
      },
      23_700_000n,
    );
  }

  function withdraw() {
    callSmartContract('withdraw', [], {
      pending: Intl.t('steps.withdrawing'),
      success: Intl.t('steps.withdraw-success'),
      error: Intl.t('steps.withdraw-failed'),
    });
  }

  return {
    opId,
    isPending,
    isSuccess,
    isError,
    deposit,
    requestWithdraw,
    withdraw,
  };
}
