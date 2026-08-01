# Superfluid Controlled Vocabulary for ASD-STE100

## 1. Purpose

Use this vocabulary with ASD-STE100 for Superfluid product, protocol, SDK, API, and architecture documentation.

The vocabulary has these objectives:

1. Use one term for one concept.
2. Separate user-facing concepts from implementation concepts.
3. Separate products from the capabilities that they contain.
4. Prevent words such as **wallet**, **provider**, **account**, **flow**, and **connection** from hiding important architectural differences.
5. Preserve exact code identifiers without permitting those identifiers to control the prose vocabulary.

Each vocabulary entry must specify:

- Preferred term
- Term type: technical name or technical verb
- Approved meaning
- Context or layer
- Permitted shortened form
- Terms that must not be used as synonyms
- Related code identifiers, when applicable

## 2. General terminology rules

### 2.1 STE writing rules

Use these ASD-STE100 rules with this controlled vocabulary:

1. Use an approved word only with the part of speech and meaning that the dictionary gives.
2. Make each instruction as clear and specific as possible.
3. Do not write a multi-word noun that has more than three words.
4. Use an approved verb form only for these purposes:
   - The infinitive form
   - The imperative form
   - The simple present tense
   - The simple past tense
   - The simple future tense
   - The past participle, only as an adjective
5. Do not use auxiliary verbs to make complex verb constructions.
6. Use the `-ing` form of a verb only as a technical noun or as a modifier in a technical noun.
7. Use the active voice.
8. In descriptive text, use the passive voice only when you do not know the agent.
9. Write no more than 20 words in each instruction sentence.
10. Write no more than 25 words in each descriptive sentence.
11. Do not omit a subject, verb, article, or other necessary sentence part to make text shorter.
12. Use a vertical list for complex text.
13. Write only one instruction in each sentence.
14. Write only one topic in each paragraph.
15. Write no more than six sentences in each paragraph.
16. Start each safety instruction with a clear command or condition.

### 2.2 One term, one concept

Do not change terms only to add variation.

Write:

> The receiver can delete the stream.

Do not write:

> The recipient can close the flow.

In this example, **receiver**, **delete**, and **stream** are the controlled terms.

### 2.3 Name the relevant layer

Do not use the name of a large product bundle when you mean one component of that bundle.

Write:

> The EIP-1193 provider sends the signing request to the wallet application.

Do not write:

> The wallet sends the request to the wallet.

### 2.4 Do not infer capabilities from product names

A component named `wallet` does not necessarily manage keys, sign data, provide RPC access, or broadcast transactions.

Describe its actual capabilities.

### 2.5 Use exact identifiers only as identifiers

Code identifiers can contain terminology that is not preferred in prose.

Write:

> Use `createFlow` to create the stream.

Do not write:

> Create the flow.

The identifier `createFlow` does not make **create a flow** an approved prose term.

### 2.6 Make ambiguous terms explicit

Do not use these terms without a modifier when more than one meaning is possible:

- wallet
- provider
- client
- account
- connection
- balance
- allowance
- permission
- operation
- pool
- app

## 3. People, accounts, and addresses

| Preferred term               | Type           | Approved meaning                                                                                            | Do not use as a synonym    |
| ---------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------- |
| **person**                   | Technical name | A human who operates or controls software.                                                                  | account, address, wallet   |
| **user**                     | Technical name | A person or organization that uses an application or service.                                               | account, address           |
| **account**                  | Technical name | An on-chain entity identified by an address.                                                                | user, wallet               |
| **externally owned account** | Technical name | An account whose authorization is based on a private-key signature. Use **EOA** after the first occurrence. | wallet, user account       |
| **contract account**         | Technical name | An account controlled by deployed contract code.                                                            | smart contract wallet      |
| **smart account**            | Technical name | A contract account that provides programmable transaction validation or execution.                          | wallet, EOA                |
| **address**                  | Technical name | The blockchain identifier of an account or contract.                                                        | account, wallet            |
| **account address**          | Technical name | The address that identifies a specified account.                                                            | wallet address             |
| **contract address**         | Technical name | The address of a deployed contract.                                                                         | endpoint, location         |
| **account owner**            | Technical name | A person or entity that has the authority defined by the applicable account model.                          | signer, wallet             |
| **operator**                 | Technical name | An account that has permission to perform specified actions for another account.                            | owner, user, administrator |

Rules:

- An address identifies an account. It is not the account itself.
- A wallet application can control or expose an account. It is not the account.
- A person can use more than one account.
- A contract account does not imply that a person controls it.
- Use **owner** only when ownership is defined by the contract or account model.

## 4. Wallet and signing architecture

The word **wallet** is permitted only when the intended layer is clear.

### 4.1 Preferred wallet terms

| Preferred term          | Type                  | Approved meaning                                                                                                                  | Do not use as a synonym         |
| ----------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| **wallet product**      | Technical name        | The complete branded product that can contain custody, signing, consent, RPC, broadcast, portfolio, or connectivity capabilities. | provider, signer                |
| **wallet application**  | Technical name        | An end-user application that manages accounts or signing authority and usually presents consent requests.                         | provider, account               |
| **wallet service**      | Technical name        | A remote service that supplies one or more wallet capabilities.                                                                   | wallet application, RPC service |
| **signing surface**     | Technical name        | The isolated user interface in which a person reviews and authorizes a signing request.                                           | wallet, popup                   |
| **signer**              | Technical name        | A software or hardware component that produces cryptographic signatures.                                                          | wallet, provider, account       |
| **signer backend**      | Technical name        | A remote service that performs or coordinates signing.                                                                            | wallet application, RPC service |
| **signing authority**   | Technical name        | The cryptographic authority required to authorize an account action.                                                              | private key, wallet             |
| **key custody**         | Technical name        | The capability that stores, derives, or controls signing keys.                                                                    | signing, account management     |
| **key custodian**       | Technical name        | The system or organization responsible for key custody.                                                                           | wallet, signer                  |
| **recovery mechanism**  | Technical name        | A method that restores access to signing authority.                                                                               | backup, login                   |
| **consent interface**   | Technical name        | A user interface that lets a person approve or reject a requested action.                                                         | signer, provider                |
| **sign**                | Technical verb        | Produce a cryptographic signature for specified data.                                                                             | approve, authorize, submit      |
| **request a signature** | Technical verb phrase | Ask a signer or wallet application to sign specified data.                                                                        | send to wallet                  |
| **authorize an action** | Technical verb phrase | Grant the authority necessary for an action.                                                                                      | sign, approve                   |
| **approve a request**   | Technical verb phrase | Select the affirmative choice in a consent interface.                                                                             | sign, authorize                 |

### 4.2 Required distinctions

**Sign**, **authorize**, and **approve** are not synonyms.

- A signer **signs** data.
- A policy or permission **authorizes** an action.
- A person **approves** a request in a consent interface.
- An approval can cause a signature, but the approval is not the signature.

Do not write:

> The wallet approves the transaction.

Write one of these:

> The person approves the request.

> The signer signs the transaction.

> The policy authorizes the transaction.

## 5. Provider, connector, and RPC vocabulary

| Preferred term              | Type           | Approved meaning                                                                                                                                              | Do not use as a synonym       |
| --------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| **EIP-1193 provider**       | Technical name | The JavaScript interface that accepts provider requests and emits provider events for an application. Use **provider** only after the context is established. | wallet, RPC endpoint          |
| **provider request**        | Technical name | A request sent through an EIP-1193 provider.                                                                                                                  | transaction, API call         |
| **provider event**          | Technical name | An event emitted through the EIP-1193 provider interface.                                                                                                     | callback, blockchain event    |
| **connector**               | Technical name | An adapter that connects application state to an EIP-1193 provider or wallet integration.                                                                     | provider, wallet              |
| **bridge**                  | Technical name | A communication component between separate processes, frames, applications, or origins.                                                                       | connector, provider           |
| **popup bridge**            | Technical name | A bridge that exchanges requests and responses with a popup window.                                                                                           | popup wallet                  |
| **RPC service**             | Technical name | A service that accepts blockchain RPC requests.                                                                                                               | provider, node, wallet        |
| **RPC endpoint**            | Technical name | A URL or transport destination for an RPC service.                                                                                                            | provider, API                 |
| **RPC request**             | Technical name | A request sent to an RPC service.                                                                                                                             | provider request, transaction |
| **RPC response**            | Technical name | The result or error returned for an RPC request.                                                                                                              | transaction result            |
| **execution client**        | Technical name | Software that implements the execution-layer protocol and can maintain blockchain state.                                                                      | RPC service, provider         |
| **node**                    | Technical name | A running blockchain client that participates in a blockchain network.                                                                                        | RPC endpoint, wallet          |
| **broadcast**               | Technical verb | Submit a signed transaction to a network through an RPC service or relayer.                                                                                   | send, sign, execute           |
| **transaction broadcaster** | Technical name | The component that broadcasts signed transactions.                                                                                                            | signer, wallet                |
| **relayer**                 | Technical name | A service that submits transactions or operations for another account or application.                                                                         | signer, bundler               |
| **bundler**                 | Technical name | An ERC-4337 service that collects and submits user operations.                                                                                                | relayer, wallet               |
| **paymaster**               | Technical name | An ERC-4337 component that supplies or controls payment for user-operation gas.                                                                               | relayer, sponsor              |

Rules:

- Do not use **provider** when you mean an RPC service.
- Do not use **wallet** when you mean an EIP-1193 provider.
- Do not say that an application “connects to the blockchain” when it sends requests to an RPC service.
- State who broadcasts the transaction when the boundary is relevant.

Example:

> The application sends read requests to the RPC service. It sends signing requests through the EIP-1193 provider. The wallet application sends approved requests to the signer backend. The application broadcasts the signed transaction.

## 6. Application and session vocabulary

| Preferred term                | Type                  | Approved meaning                                                                                              | Do not use as a synonym |
| ----------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------- |
| **application**               | Technical name        | Software that supplies a user-facing or programmatic function.                                                | wallet, service         |
| **decentralized application** | Technical name        | An application that interacts with blockchain contracts. Use **dapp** only when the distinction is necessary. | website, wallet         |
| **wallet session**            | Technical name        | A persistent relationship between an application and a wallet application or wallet service.                  | login, account          |
| **provider connection**       | Technical name        | The application state in which an EIP-1193 provider is available.                                             | wallet connection       |
| **account access**            | Technical name        | Permission for an application to obtain or use one or more account addresses.                                 | wallet connection       |
| **permission**                | Technical name        | Authority granted to an application, account, or operator for specified actions.                              | allowance, policy       |
| **policy**                    | Technical name        | A rule that determines whether a requested action is permitted.                                               | permission, consent     |
| **session key**               | Technical name        | A key with limited authority for a defined session or policy.                                                 | wallet key, API key     |
| **connect an application**    | Technical verb phrase | Establish the required provider or wallet session for an application.                                         | connect an account      |
| **request account access**    | Technical verb phrase | Ask a wallet application or provider to expose account addresses.                                             | connect wallet          |
| **end a wallet session**      | Technical verb phrase | Remove or invalidate a wallet session.                                                                        | disconnect the account  |

The user-interface label **Connect wallet** is permitted as established product language. Architecture and procedure text must state the actual effect.

Example:

> Select **Connect wallet**. The application requests account access through the EIP-1193 provider.

Do not write:

> Connecting a wallet gives the dapp access to the user’s funds.

## 7. Network and transaction vocabulary

| Preferred term                 | Type                  | Approved meaning                                                                              | Do not use as a synonym       |
| ------------------------------ | --------------------- | --------------------------------------------------------------------------------------------- | ----------------------------- |
| **network**                    | Technical name        | A specified blockchain deployment, such as Base or Ethereum Mainnet.                          | chain, blockchain             |
| **chain ID**                   | Technical name        | The numeric identifier of a blockchain network.                                               | network ID                    |
| **blockchain**                 | Technical name        | The general distributed ledger technology or the chain of blocks itself.                      | network                       |
| **transaction**                | Technical name        | Signed transaction data submitted for inclusion in a blockchain.                              | request, operation, signature |
| **unsigned transaction**       | Technical name        | Transaction data that does not yet contain the required signature.                            | transaction request           |
| **signed transaction**         | Technical name        | Transaction data that contains the required signature.                                        | approved transaction          |
| **transaction hash**           | Technical name        | The hash that identifies a submitted transaction.                                             | transaction ID                |
| **contract call**              | Technical name        | Execution of a contract function. A contract call can occur in a read request or transaction. | transaction                   |
| **read request**               | Technical name        | A request that reads network state without submitting a transaction.                          | read transaction              |
| **state-changing transaction** | Technical name        | A transaction that can modify blockchain state.                                               | write request                 |
| **build a transaction**        | Technical verb phrase | Construct unsigned transaction data.                                                          | create a transaction on-chain |
| **submit a transaction**       | Technical verb phrase | Send a signed transaction for broadcast or inclusion.                                         | sign, execute                 |
| **confirm a transaction**      | Technical verb phrase | Determine that the network included the transaction in a block.                               | approve, finalize             |

## 8. Superfluid protocol vocabulary

| Preferred term               | Type           | Approved meaning                                                                                                       | Do not use as a synonym      |
| ---------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| **Superfluid Protocol**      | Technical name | The protocol that implements Super Token agreements and related operations. Use **protocol** after first occurrence.   | Superfluid network           |
| **Superfluid deployment**    | Technical name | The set of Superfluid contracts deployed on one network.                                                               | protocol, network            |
| **Superfluid Host**          | Technical name | The central protocol contract that coordinates agreement and Super App execution. Use **Host** after first occurrence. | router, protocol             |
| **agreement**                | Technical name | A protocol component that defines a category of continuous or stateful Super Token behavior.                           | contract, operation          |
| **agreement class**          | Technical name | A contract implementation for one agreement type.                                                                      | agreement operation          |
| **protocol operation**       | Technical name | A high-level action performed through the Superfluid Protocol.                                                         | transaction, contract call   |
| **batch operation**          | Technical name | A transaction that contains multiple protocol operations.                                                              | batch transaction, multicall |
| **Super Token**              | Technical name | A token that supports Superfluid agreement operations.                                                                 | supertoken, streaming token  |
| **underlying token**         | Technical name | The token represented by a wrapper Super Token.                                                                        | base token, backing token    |
| **wrapper Super Token**      | Technical name | A Super Token backed by an underlying token.                                                                           | wrapped Super Token          |
| **pure Super Token**         | Technical name | A Super Token that does not wrap an underlying token.                                                                  | native Super Token           |
| **native-asset Super Token** | Technical name | A Super Token that represents a network native asset.                                                                  | native token                 |
| **wrap**                     | Technical verb | Exchange an underlying token or native asset for its corresponding Super Token.                                        | upgrade, convert             |
| **unwrap**                   | Technical verb | Exchange a wrapper Super Token for its underlying token or native asset.                                               | downgrade, redeem            |

Use **operation** for a protocol-level action. Use **transaction** only for the signed blockchain transaction that carries one or more operations.

## 9. Streaming vocabulary

Use **stream** for the user-facing concept. Use **flow** only for defined implementation concepts and exact code names.

| Preferred term              | Type                  | Approved meaning                                                                        | Do not use as a synonym    |
| --------------------------- | --------------------- | --------------------------------------------------------------------------------------- | -------------------------- |
| **stream**                  | Technical name        | A continuous transfer of one Super Token from one sender to one receiver.               | payment, distribution      |
| **money streaming**         | Technical name        | The protocol capability that transfers Super Tokens continuously.                       | real-time finance          |
| **sender**                  | Technical name        | The account from which a stream transfers tokens.                                       | payer, source              |
| **receiver**                | Technical name        | The account to which a stream transfers tokens.                                         | recipient, beneficiary     |
| **flow rate**               | Technical name        | The amount that a stream transfers per unit of time.                                    | speed, stream amount       |
| **protocol flow rate**      | Technical name        | A flow rate represented in the protocol’s canonical per-second unit.                    | displayed flow rate        |
| **display rate**            | Technical name        | A flow rate converted to a user-facing time unit, such as tokens per month.             | flow rate                  |
| **net flow rate**           | Technical name        | The sum of an account’s inbound and outbound flow rates for one Super Token.            | net flow, cash flow        |
| **inbound stream**          | Technical name        | A stream for which the specified account is the receiver.                               | incoming flow              |
| **outbound stream**         | Technical name        | A stream for which the specified account is the sender.                                 | outgoing flow              |
| **Constant Flow Agreement** | Technical name        | The agreement class that implements direct streams. Use **CFA** after first occurrence. | streaming protocol         |
| **flow operator**           | Technical name        | An account authorized to manage streams for another account.                            | delegate, owner            |
| **flow permission**         | Technical name        | Permission to create, update, or delete streams for another account.                    | allowance                  |
| **flow-rate allowance**     | Technical name        | The maximum aggregate flow rate that an operator can create for an account.             | token allowance            |
| **create a stream**         | Technical verb phrase | Create a stream that does not exist.                                                    | start, open, create a flow |
| **update a stream**         | Technical verb phrase | Change the flow rate of an existing stream.                                             | edit, modify               |
| **delete a stream**         | Technical verb phrase | Terminate an existing stream.                                                           | stop, close, cancel        |
| **stream**                  | Technical verb        | Transfer Super Tokens continuously.                                                     | flow, drip                 |

Code example:

> Call `createFlow` to create a stream.

Concept example:

> The sender streams USDCx to the receiver at 100 USDCx per month.

## 10. Distribution vocabulary

| Preferred term                     | Type                  | Approved meaning                                                                                               | Do not use as a synonym   |
| ---------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------- |
| **distribution**                   | Technical name        | A proportional transfer of Super Tokens through a distribution pool.                                           | payout, stream            |
| **distribution pool**              | Technical name        | A contract that allocates distributions among members according to units. Use **pool** after first occurrence. | index, channel            |
| **pool administrator**             | Technical name        | The account authorized to manage pool configuration and member units.                                          | owner, publisher          |
| **pool member**                    | Technical name        | An account that has units in a pool. Use **member** after first occurrence.                                    | subscriber, receiver      |
| **distributor**                    | Technical name        | An account that supplies an instant or streaming distribution to a pool.                                       | sender, administrator     |
| **unit**                           | Technical name        | An integer used to calculate a member’s proportion of distributions.                                           | token, point, share       |
| **member units**                   | Technical name        | The units assigned to one member.                                                                              | unit balance, shares      |
| **total units**                    | Technical name        | The sum of all member units in a pool.                                                                         | pool size                 |
| **member share**                   | Technical name        | The ratio of a member’s units to the pool’s total units.                                                       | units                     |
| **instant distribution**           | Technical name        | A one-time distribution of a specified token amount.                                                           | payment, lump sum         |
| **streaming distribution**         | Technical name        | A continuous distribution to a pool.                                                                           | stream, flow distribution |
| **distribution amount**            | Technical name        | The token amount supplied for an instant distribution.                                                         | payout                    |
| **distribution flow rate**         | Technical name        | The total flow rate from one distributor to one pool.                                                          | pool amount               |
| **member flow rate**               | Technical name        | The part of a distribution flow rate allocated to one member.                                                  | member share              |
| **flow rate per unit**             | Technical name        | The distribution flow rate divided by the total units.                                                         | unit value                |
| **connected member**               | Technical name        | A member whose pool distribution is reflected directly in the member’s balance.                                | active member             |
| **disconnected member**            | Technical name        | A member whose pool distribution accumulates until it is claimed or the member connects.                       | inactive member           |
| **claimable amount**               | Technical name        | An accumulated token amount that a member can claim from a pool.                                               | reserve, reward           |
| **General Distribution Agreement** | Technical name        | The agreement class that implements distribution pools. Use **GDA** after first occurrence.                    | distribution protocol     |
| **create a pool**                  | Technical verb phrase | Deploy and configure a new distribution pool.                                                                  | open a pool               |
| **set member units**               | Technical verb phrase | Replace the current units of a member with a specified value.                                                  | give shares, add points   |
| **distribute**                     | Technical verb        | Supply an amount for an instant distribution.                                                                  | pay, send                 |
| **stream to a pool**               | Technical verb phrase | Create a streaming distribution from a distributor to a pool.                                                  | flow-distribute           |
| **connect to a pool**              | Technical verb phrase | Change a member to the connected state.                                                                        | subscribe, join           |
| **disconnect from a pool**         | Technical verb phrase | Change a member to the disconnected state.                                                                     | unsubscribe, leave        |
| **claim a distribution**           | Technical verb phrase | Transfer a claimable amount from a pool to a member.                                                           | withdraw, redeem          |

Important distinctions:

- A unit is an input to the allocation calculation. It is not a token or a payment.
- A member share is calculated from units. It is not the same concept as member units.
- A distributor supplies tokens. A pool administrator manages the pool.
- One account can be both distributor and pool administrator, but the roles remain separate.
- Use **index**, **publisher**, and **subscriber** only in documentation that specifically describes the legacy Instant Distribution Agreement.

## 11. Balance, amount, rate, and allowance

| Preferred term               | Approved meaning                                                                        | Do not use as a synonym         |
| ---------------------------- | --------------------------------------------------------------------------------------- | ------------------------------- |
| **token amount**             | A specified quantity of tokens.                                                         | balance, rate                   |
| **account balance**          | The token quantity associated with an account at a specified time.                      | amount, wallet balance          |
| **available balance**        | The balance value available under the applicable Super Token accounting rules.          | wallet balance, spendable funds |
| **real-time balance**        | A balance calculated for a specified timestamp from stored state and active agreements. | live balance                    |
| **static balance component** | The stored component used in real-time balance calculation.                             | ERC-20 balance                  |
| **flow rate**                | A token amount per unit of time.                                                        | amount, balance                 |
| **token allowance**          | An ERC-20 allowance granted to a spender.                                               | permission, flow-rate allowance |
| **flow-rate allowance**      | An operator limit expressed as a flow rate.                                             | token allowance                 |
| **claimable amount**         | An amount accumulated for a later claim.                                                | balance, reserve                |
| **buffer**                   | A token amount locked by the protocol to support an active agreement.                   | reserve, fee, collateral        |

Always include the unit when a number represents a rate.

Write:

> The flow rate is 38 wei per second.

> The interface displays 100 USDCx per month.

Do not write:

> The flow rate is 100.

## 12. Permission and approval vocabulary

Use these terms only for their defined meanings:

- **permission**: authority granted to an account or application.
- **policy**: a rule that determines whether an action is permitted.
- **token allowance**: an ERC-20 spending limit.
- **flow-rate allowance**: an operator limit for stream creation.
- **consent**: a person’s affirmative decision in a user interface.
- **signature**: a cryptographic result.
- **authorization**: the authority that permits an action.
- **approval transaction**: a transaction that calls an approval function, such as ERC-20 `approve`.

Do not use **approve** as a general replacement for all of these concepts.

## 13. Super App vocabulary

| Preferred term           | Type                  | Approved meaning                                                                                              | Do not use as a synonym    |
| ------------------------ | --------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------- |
| **Super App**            | Technical name        | A contract registered with the Host to receive agreement callbacks.                                           | dapp, application contract |
| **callback**             | Technical name        | A function that the Host calls before or after an agreement operation.                                        | hook, event                |
| **before-callback**      | Technical name        | A callback executed before an agreement operation.                                                            | pre-hook                   |
| **after-callback**       | Technical name        | A callback executed after an agreement operation.                                                             | post-hook                  |
| **callback data**        | Technical name        | Data passed from a before-callback to its corresponding after-callback.                                       | user data, context         |
| **user data**            | Technical name        | Application-defined data supplied with a protocol operation.                                                  | callback data, metadata    |
| **context**              | Technical name        | Protocol execution data passed through agreement and callback execution. Use `ctx` only as a code identifier. | user data                  |
| **jailed Super App**     | Technical name        | A Super App that the protocol has disabled because it violated a callback rule.                               | blocked app                |
| **register a Super App** | Technical verb phrase | Register a contract as a Super App with the Host.                                                             | approve an app             |
| **call a callback**      | Technical verb phrase | Execute a callback function.                                                                                  | fire a callback            |
| **trigger a callback**   | Technical verb phrase | Cause the Host to call a callback because an agreement operation occurred.                                    | invoke a hook              |
| **jail a Super App**     | Technical verb phrase | Disable a Super App because it violated a protocol rule.                                                      | ban, block                 |

## 14. Solvency and liquidation vocabulary

| Preferred term                  | Type                  | Approved meaning                                                                                                         | Do not use as a synonym |
| ------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| **solvent account**             | Technical name        | An account that can satisfy its current protocol obligations.                                                            | healthy account         |
| **critical account**            | Technical name        | An account that is in the protocol-defined critical state.                                                               | insolvent account       |
| **insolvent account**           | Technical name        | An account that cannot satisfy its protocol obligations.                                                                 | critical account        |
| **liquidation**                 | Technical name        | A protocol operation that terminates an eligible stream because of insufficient solvency.                                | cancellation, closure   |
| **sentinel**                    | Technical name        | An external actor or service that identifies and liquidates eligible streams.                                            | bot, keeper             |
| **liquidation reward**          | Technical name        | A token amount allocated under the liquidation rules.                                                                    | bounty, prize           |
| **Patrician in Charge**         | Technical name        | The account eligible for specified liquidation rewards during the applicable period. Use **PIC** after first occurrence. | liquidator              |
| **Transparent Ongoing Auction** | Technical name        | The auction mechanism used to select the PIC. Use **TOGA** after first occurrence.                                       | auction contract        |
| **stake**                       | Technical name        | Tokens locked under the TOGA mechanism.                                                                                  | deposit, buffer         |
| **liquidate a stream**          | Technical verb phrase | Perform an eligible liquidation operation on a stream.                                                                   | delete, cancel          |

## 15. Words that require qualification

The following words are not prohibited, but documentation must qualify them.

### Wallet

Use:

- wallet product
- wallet application
- wallet service
- signing surface

Do not use bare **wallet** in architecture documentation unless the document first defines its scope.

### Provider

Use:

- EIP-1193 provider
- RPC service
- infrastructure provider

Do not assume that a provider manages keys.

### Client

Use:

- execution client
- RPC client
- SDK client
- application client

Avoid bare **client**.

### Connect

Always identify both the subject and object.

Use:

- connect the application to the wallet application
- connect through the EIP-1193 provider
- connect a member to the pool
- connect to the RPC service

Do not write:

> Connect the account.

### Send

Use a more specific verb when possible:

- submit a transaction
- broadcast a transaction
- send an RPC request
- stream Super Tokens
- distribute Super Tokens
- transfer tokens
- send a provider request

## 16. Product-copy exceptions

Some established interface labels can remain shorter than the technical documentation:

- Connect wallet
- Disconnect
- Approve
- Sign
- Claim
- Stream
- Distribute

The procedure text must explain the exact effect of the action.

Example:

> Select **Connect wallet**. The application requests account access through the EIP-1193 provider.

> Select **Approve**. The wallet application asks the signer to sign the token-allowance transaction.

## 17. Terminology database requirements

The maintained vocabulary should not be only a Markdown glossary. Store it in a structured format with these fields:

```text
term
term_type
layer
definition
approved_contexts
allowed_short_forms
disallowed_synonyms
related_terms
code_identifiers
first_use_rule
usage_example
incorrect_example
status
```

Recommended layers:

```text
person
account
wallet_product
custody
signing
consent
provider
connector
rpc
transaction
network
protocol
super_token
streaming
distribution
super_app
solvency
sdk
api
indexing
product_ui
```

This structure permits automated terminology checks without treating every occurrence of words such as `flow`, `wallet`, or `provider` as an error.

## 18. Core editorial rules

1. Use **stream** for the user-facing concept and **flow** for defined implementation concepts or exact identifiers.
2. Use **distribution pool** for the concept and **GDA** for its agreement implementation.
3. Use **wallet application**, **signer**, **EIP-1193 provider**, and **RPC service** as separate terms.
4. Do not use **account**, **address**, **wallet**, and **user** as synonyms.
5. Do not use **transaction**, **request**, **contract call**, and **protocol operation** as synonyms.
6. Do not use **sign**, **approve**, **authorize**, and **permit** as synonyms.
7. Do not use **amount**, **balance**, **rate**, **units**, and **share** as synonyms.
8. Expand abbreviations at first occurrence on each page.
9. Preserve exact API and contract identifiers in code formatting.
10. State the responsible component when custody, signing, RPC, or broadcast boundaries are relevant.
11. Do not describe delegated capabilities as if one product performs all wallet functions.
12. Do not use marketing language to replace a technical description.

## 19. Normalization examples

Uncontrolled:

> The wallet connects the user and sends the flow transaction to the blockchain.

Controlled:

> The application requests account access through the EIP-1193 provider. The wallet application asks the signer to sign the transaction. The application broadcasts the signed transaction through the RPC service.

Uncontrolled:

> The user’s wallet has an incoming flow.

Controlled:

> The account has an inbound stream.

Uncontrolled:

> Turnkey is the wallet.

Controlled:

> Turnkey supplies the signer backend and key-custody service. The wallet application supplies the consent interface.

Uncontrolled:

> The provider signs and sends the transaction.

Controlled:

> The EIP-1193 provider forwards the signing request to the wallet application. The signer signs the transaction. The transaction broadcaster submits it to the RPC service.

Uncontrolled:

> The admin gives shares to subscribers.

Controlled:

> The pool administrator sets the units of each pool member.

Uncontrolled:

> Connect your wallet to the pool to receive your funds.

Controlled:

> Connect the application to your wallet application. Then connect your account to the distribution pool. A connected member receives distributions in its account balance.
