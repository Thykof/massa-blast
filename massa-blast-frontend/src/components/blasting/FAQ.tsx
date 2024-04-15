export function FAQ() {
  return (
    <div className="w-full">
      <div className="mb-4">
        <strong>How does it work?</strong>
        <p>
          When you deposit, the smart contract will record your session
          information, including the amount and start time, then transfer the
          deposited sum to a staking node. Next, you will be able to request a
          withdrawal—please wait a little to accrue some rewards. This action
          will log your withdrawal request, and a service monitoring the smart
          contract will calculate the rewards, deduct fees, and transfer the
          appropriate amount to the smart contract. Finally, you will withdraw
          the calculated amount and clear the data related to your session.
        </p>
      </div>
      <div className="mb-4">
        <strong>Why do I pay more coins than I deposit?</strong>
        <p>
          In Massa, you are required to pay for storage costs. At the conclusion
          of your staking session, the data allocated for your session is
          destroyed, and the storage fee is reimbursed to you.
        </p>
      </div>
      <div className="mb-4">
        <strong>How do you calculate the rewards?</strong>
        <p>
          Every three cycles, a server gathers the amount of staked rolls. The
          system then takes the start and end dates of your session, along with
          your deposited amount, and reviews the staking roll records over time.
          Any rewards exceeding 100 MAS will be automatically compounded.
        </p>
      </div>
      <div className="mb-4">
        <strong>How do you calculate the fees?</strong>
        <p>
          When computing rewards, the system accounts for an activation period
          of three cycles (for more information, visit{' '}
          <a href="https://docs.massa.net/docs/node/stake#telling-your-node-to-start-staking-with-your-rolls">
            https://docs.massa.net/docs/node/stake#telling-your-node-to-start-staking-with-your-rolls
          </a>
          ) plus an additional three cycles for service fees. During this time,
          your MAS are not accruing rewards for you. Afterwards, the system
          imposes a fee of 10 percent on the rewards.
        </p>
      </div>
      <div className="mb-4">
        <strong>
          Can I see the potential rewards before requesting a withdrawal?
        </strong>
        <p>
          This feature is in development, but you can obtain a preliminary
          estimation using the community tool at{' '}
          <a href="https://n0futur3.com/massa/calculator">
            https://n0futur3.com/massa/calculator
          </a>
          .
        </p>
      </div>
      <div className="mb-4">
        <strong>What is the contract address?</strong>
        <p>
          The contract address is{' '}
          <a href="https://explorer.massa.net/mainnet/address/AS1mPyb6HCqATWDRQKi4gPSfbphdaGv1pwEscLuKVaQgcktmVTqY/">
            AS1mPyb6HCqATWDRQKi4gPSfbphdaGv1pwEscLuKVaQgcktmVTqY
          </a>
          .
        </p>
      </div>
      <div className="mb-4">
        <strong>How do you respect the charter?</strong>
        <p>
          The community charter limits the amount any entity can stake on users'
          behalf to 1,000,000 MAS, as outlined here:{' '}
          <a href="https://github.com/massalabs/massa/blob/main/COMMUNITY_CHARTER.md">
            https://github.com/massalabs/massa/blob/main/COMMUNITY_CHARTER.md
          </a>
          . This limit is enforced within the smart contract, and you can verify
          this by attempting to deposit 1,000,000 MAS—if you have that much.
          You'll find that the operation is rejected, as a dry run of the
          transaction will fail.
        </p>
      </div>
      <div className="mb-4">
        <strong>How did you create the website?</strong>
        <p>
          I was inspired by the official DApp created by the MassaLabs team at{' '}
          <a href="https://github.com/massalabs/coin-vester/">
            https://github.com/massalabs/coin-vester/
          </a>
          . This GitHub repository comprises both a frontend and a smart
          contract that execute similar functions to what we aim to achieve
          here. MassaLabs has also developed a React UI kit, accessible at{' '}
          <a href="https://github.com/massalabs/Ui-Kit/">
            https://github.com/massalabs/Ui-Kit/
          </a>
          , which features an array of excellent components and a Tailwind
          preset example. The source code of Massa Station uses this kit, making
          it an exceptional resource for any community developer!
        </p>
      </div>
      <div className="mb-4">
        <strong>Who are you?</strong>
        <p>
          I'm a team member of MassaLabs, I contributed to{' '}
          <a href="https://station.massa.net">Massa Station</a>, Massa Wallet
          and the <a href="https://station.massa.net">Bridge</a>. You can visit
          my GitHub account at{' '}
          <a href="https://github.com/thykof">https://github.com/thykof</a> to
          check that ;).
        </p>
      </div>
      <div className="mb-4">
        <strong>Why should I trust you?</strong>
        <p>
          You can deposit a minimal amount of 10 MAS and withdraw it, observing
          that you get your MAS back. Since it's a short period of time and a
          low amount, you might not see any rewards.
        </p>
      </div>
    </div>
  );
}
