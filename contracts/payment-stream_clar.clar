;; ============================================================================
;; USDCx Streaming Payment Protocol
;; ============================================================================
;;
;; A minimal, auditable continuous payment streaming protocol for USDCx on Stacks.
;; Enables streaming payment flows with lazy accounting (no background processes).
;;
;; Key Features:
;; - Payments flow at X micro-USDCx per interval
;; - Recipients can withdraw accrued funds anytime
;; - Senders can cancel streams with final settlement
;; - All accounting happens on-demand (lazy evaluation)
;; - Integer-safe calculations with overflow protection
;; - Senders can pause, resume and top-up streams
;;
;; ============================================================================

;; Testnet contract: ST30J9EZKY44SS1EBT8XNKJFA77Z4TSDBEMZ55MEJ.precious-white-sparrow
;; Mainnet contract: 

(use-trait ft-trait 'ST1NXBK3K5YYMD6FD41MVNP3JS1GABZ8TRVX023PT.sip-010-trait-ft-standard.sip-010-trait)

;; ============================================================================
;; CONSTANTS & ERROR CODES
;; ============================================================================

(define-constant contract-owner tx-sender)
(define-constant max-rate u10000000000)
(define-constant max-interval u100000000)
(define-constant max-deposit u1000000000000000)

;; Error codes
(define-constant err-owner-only (err u100))
(define-constant err-not-authorized (err u101))
(define-constant err-stream-not-found (err u102))
(define-constant err-stream-inactive (err u103))
(define-constant err-invalid-rate (err u104))
(define-constant err-invalid-recipient (err u105))
(define-constant err-transfer-failed (err u106))
(define-constant err-invalid-amount (err u107))
(define-constant err-already-withdrawn (err u108))
(define-constant err-stream-paused (err u109))
(define-constant err-invalid-interval (err u110))
(define-constant err-invalid-token (err u111))
(define-constant err-stream-not-paused (err u112))

;; USDCx Token Contract References
;; Mainnet: SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx
;; Testnet: ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx
;; Testnet USDCx Mock: ST30J9EZKY44SS1EBT8XNKJFA77Z4TSDBEMZ55MEJ.charming-amethyst-pinniped

;; ============================================================================
;; DATA STRUCTURES
;; ============================================================================

;; Stream counter for generating unique stream IDs
(define-data-var stream-counter uint u0)

;; Main streams map
(define-map streams
  { stream-id: uint }
  {
    sender: principal, ;; Address that created and funds the stream
    recipient: principal, ;; Address that receives payments
    token: principal, ;; Address of the token to stream 
    rate: uint, ;; Micro-USDCx per block
    deposit: uint, ;; Total USDCx deposited (in micro-USDCx)
    interval: uint, ;; blocks between payments
    start-block: uint, ;; Block when stream was created
    last-withdrawal-block: uint, ;; Last block when funds were withdrawn
    withdrawn-total: uint, ;; Total amount withdrawn so far
    is-paused: bool, ;; Stream status 
  }
)

;; ============================================================================
;; PRIVATE HELPER FUNCTIONS
;; ============================================================================

;; Calculate amount owed to recipient based on blocks elapsed and interval
(define-private (calculate-owed-amount
    (blocks-elapsed uint)
    (rate uint)
    (deposit uint)
    (withdrawn-total uint)
    (interval uint)
  )
  (let (
      (intervals-completed (/ blocks-elapsed interval))
      (newly-earned (* intervals-completed rate)) ;; Delta since last withdrawal
      (remaining (- deposit withdrawn-total)) ;; What's left in the stream
    )
    ;; Cap the newly earned amount by what's remaining
    (if (>= newly-earned remaining)
      remaining
      newly-earned
    )
  )
)

;; ============================================================================
;; READ-ONLY FUNCTIONS
;; ============================================================================

;; Get complete stream information
(define-read-only (get-stream (stream-id uint))
  (map-get? streams { stream-id: stream-id })
)

;; Calculate currently owed amount for a stream
;; This is the primary lazy accounting function - computes owed amount on-demand
(define-read-only (get-owed-amount (stream-id uint))
  (let ((stream-data (unwrap! (map-get? streams { stream-id: stream-id })
      (err err-stream-not-found)
    )))
    ;; Return 0 if paused
    (if (get is-paused stream-data)
      (ok u0)
      (let (
          (current-block stacks-block-height)
          (last-withdrawal (get last-withdrawal-block stream-data))
          (blocks-elapsed (- current-block last-withdrawal))
          (rate (get rate stream-data))
          (deposit (get deposit stream-data))
          (interval (get interval stream-data))
          (withdrawn-total (get withdrawn-total stream-data))
          (owed-amount (calculate-owed-amount blocks-elapsed rate deposit withdrawn-total
            interval
          ))
        )
        (ok owed-amount)
      )
    )
  )
)

;; Get current stream counter value
(define-read-only (get-stream-counter)
  (ok (var-get stream-counter))
)

;; Check if a stream exists and is paused
(define-read-only (is-stream-paused (stream-id uint))
  (match (map-get? streams { stream-id: stream-id })
    stream (ok (get is-paused stream))
    (err err-stream-not-found)
  )
)

;; Get all key stats for a stream in one call
(define-read-only (get-stream-stats (stream-id uint))
  (let (
      (stream-data (unwrap! (map-get? streams { stream-id: stream-id })
        (err err-stream-not-found)
      ))
      (owed (unwrap! (get-owed-amount stream-id) (err err-stream-inactive)))
    )
    (ok {
      sender: (get sender stream-data),
      recipient: (get recipient stream-data),
      token: (get token stream-data),
      rate: (get rate stream-data),
      deposit: (get deposit stream-data),
      interval: (get interval stream-data),
      withdrawn: (get withdrawn-total stream-data),
      owed: owed,
      is-paused: (get is-paused stream-data),
      blocks-elapsed: (- stacks-block-height (get last-withdrawal-block stream-data)),
    })
  )
)

;; ============================================================================
;; PUBLIC FUNCTIONS
;; ============================================================================

;; Create a new payment stream
;; Returns: stream-id on success
;;
(define-public (create-stream
    (recipient principal)
    (rate uint)
    (deposit-amount uint)
    (interval uint)
    (token <ft-trait>)
  )
  (let (
      (sender tx-sender)
      (current-block stacks-block-height)
      (new-stream-id (+ (var-get stream-counter) u1))
    )
    ;; Validation checks
    (asserts! (> rate u0) err-invalid-rate)
    (asserts! (<= rate max-rate) err-invalid-rate)
    (asserts! (<= interval max-interval) err-invalid-interval)
    (asserts! (> deposit-amount u0) err-invalid-amount)
    (asserts! (<= deposit-amount max-deposit) err-invalid-amount)
    (asserts! (> interval u0) err-invalid-rate)
    (asserts! (not (is-eq recipient sender)) err-invalid-recipient)

    ;; Transfer deposit from sender to this contract
    ;; Using contract-call? to interact with SIP-010 token
    (match (contract-call? token transfer deposit-amount sender (as-contract tx-sender)
      none
    )
      success (begin
        ;; Create the stream entry
        (map-set streams { stream-id: new-stream-id } {
          sender: sender,
          recipient: recipient,
          rate: rate,
          token: (contract-of token),
          deposit: deposit-amount,
          interval: interval,
          start-block: current-block,
          last-withdrawal-block: current-block,
          withdrawn-total: u0,
          is-paused: false,
        })

        ;; Increment stream counter
        (var-set stream-counter new-stream-id)

        ;; Print create-stream event
        (print {
          event: "create-stream",
          stream-id: new-stream-id,
          sender: sender,
          recipient: recipient,
          rate: rate,
          token: (contract-of token),
          deposit: deposit-amount,
          interval: interval,
          start-block: current-block,
        })

        ;; Emit success with stream ID
        (ok new-stream-id)
      )
      error err-transfer-failed
    )
  )
)

;; Withdraw accrued funds from a stream
;; Returns: amount withdrawn on success
;;
(define-public (withdraw-from-stream
    (stream-id uint)
    (token <ft-trait>)
  )
  (let (
      (stream-data (unwrap! (map-get? streams { stream-id: stream-id }) err-stream-not-found))
      (recipient (get recipient stream-data))
      (token-principal (get token stream-data))
      (caller tx-sender)
      (current-block stacks-block-height)
    )
    ;; Validation checks
    (asserts! (is-eq caller recipient) err-not-authorized)
    (asserts! (is-eq (contract-of token) token-principal) err-invalid-token)
    (asserts! (not (get is-paused stream-data)) err-stream-paused)

    ;; Calculate owed amount using helper function
    (let (
        (last-withdrawal (get last-withdrawal-block stream-data))
        (blocks-elapsed (- current-block last-withdrawal))
        (rate (get rate stream-data))
        (deposit (get deposit stream-data))
        (withdrawn-total (get withdrawn-total stream-data))
        (interval (get interval stream-data))
        (amount-owed (calculate-owed-amount blocks-elapsed rate deposit withdrawn-total
          interval
        ))
      )
      ;; Edge case: If trying to withdraw in same block as last withdrawal, amount is 0
      ;; Edge case: If all funds already withdrawn, amount is 0

      (if (> amount-owed u0)
        ;; Transfer owed amount from contract to recipient
        (match (as-contract (contract-call? token transfer amount-owed tx-sender recipient none))
          success (begin
            ;; Update stream state
            (map-set streams { stream-id: stream-id }
              (merge stream-data {
                last-withdrawal-block: current-block,
                withdrawn-total: (+ withdrawn-total amount-owed),
              })
            )

            ;; Print withdraw-from-stream event
            (print {
              event: "withdraw-from-stream",
              stream-id: stream-id,
              sender: caller,
              amount-withdrawn: amount-owed,
              withdrawn-total: (+ withdrawn-total amount-owed),
            })

            (ok amount-owed)
          )
          error err-transfer-failed
        )
        ;; No funds to withdraw - return ok with 0
        (ok u0)
      )
    )
  )
)

;; Cancel a stream and settle final payment
;; Returns: ok true on success
;;
(define-public (cancel-stream
    (stream-id uint)
    (token <ft-trait>)
  )
  (let (
      (stream-data (unwrap! (map-get? streams { stream-id: stream-id }) err-stream-not-found))
      (sender (get sender stream-data))
      (recipient (get recipient stream-data))
      (token-principal (get token stream-data))
      (caller tx-sender)
      (current-block stacks-block-height)
    )
    ;; Validation checks
    (asserts! (is-eq caller sender) err-not-authorized)
    (asserts! (is-eq (contract-of token) token-principal) err-invalid-token)

    ;; Calculate final settlement
    (let (
        (last-withdrawal (get last-withdrawal-block stream-data))
        (blocks-elapsed (- current-block last-withdrawal))
        (rate (get rate stream-data))
        (deposit (get deposit stream-data))
        (withdrawn-total (get withdrawn-total stream-data))
        (interval (get interval stream-data))
        (amount-owed (calculate-owed-amount blocks-elapsed rate deposit withdrawn-total
          interval
        ))
        (total-withdrawn-after (+ withdrawn-total amount-owed))
        (remaining-deposit (- deposit total-withdrawn-after))
      )
      ;; Transfer owed amount to recipient (if any)
      (if (> amount-owed u0)
        (unwrap!
          (as-contract (contract-call? token transfer amount-owed tx-sender recipient none))
          err-transfer-failed
        )
        true
      )

      ;; Return remaining deposit to sender (if any)
      (if (> remaining-deposit u0)
        (unwrap!
          (as-contract (contract-call? token transfer remaining-deposit tx-sender sender none))
          err-transfer-failed
        )
        true
      )

      ;; Delete the stream
      (map-delete streams { stream-id: stream-id })

      ;; Print cancel-stream event
      (print {
        event: "cancel-stream",
        stream-id: stream-id,
        sender: sender,
        amount-owed: amount-owed,
        remaining-deposit: remaining-deposit,
      })

      (ok true)
    )
  )
)

;; Pause a stream (only sender)
;; Sets is-paused to true but preserves all other state
;; Paused streams stop accruing owed amounts but can be resumed
(define-public (pause-stream
    (stream-id uint)
    (token <ft-trait>)
  )
  (let (
      (stream-data (unwrap! (map-get? streams { stream-id: stream-id }) err-stream-not-found))
      (sender (get sender stream-data))
      (recipient (get recipient stream-data))
      (caller tx-sender)
      (current-block stacks-block-height)
      ;; Calculate owed amount before pausing
      (last-withdrawal (get last-withdrawal-block stream-data))
      (blocks-elapsed (- current-block last-withdrawal))
      (rate (get rate stream-data))
      (deposit (get deposit stream-data))
      (withdrawn-total (get withdrawn-total stream-data))
      (interval (get interval stream-data))
      (amount-owed (calculate-owed-amount blocks-elapsed rate deposit withdrawn-total interval))
    )
    ;; Validation checks
    (asserts! (is-eq caller sender) err-not-authorized)
    (asserts! (not (get is-paused stream-data)) err-stream-paused)
    (asserts! (is-eq (contract-of token) (get token stream-data))
      err-invalid-token
    )

    ;; Transfer owed amount to recipient BEFORE pausing
    (if (> amount-owed u0)
      (unwrap!
        (as-contract (contract-call? token transfer amount-owed tx-sender recipient none))
        err-transfer-failed
      )
      true
    )

    ;; Now pause with updated state
    (map-set streams { stream-id: stream-id }
      (merge stream-data {
        is-paused: true,
        last-withdrawal-block: current-block,
        withdrawn-total: (+ withdrawn-total amount-owed),
      })
    )

    (print {
      event: "pause-stream",
      stream-id: stream-id,
      settled-amount: amount-owed,
      paused-at-block: current-block,
    })

    (ok amount-owed)
  )
)

;; Resume a paused stream (only sender)
;; Sets is-active to true, resumes from current block
;; No funds are lost during pause period
(define-public (resume-stream (stream-id uint))
  (let (
      (stream-data (unwrap! (map-get? streams { stream-id: stream-id }) err-stream-not-found))
      (sender (get sender stream-data))
      (caller tx-sender)
    )
    ;; Validation checks
    (asserts! (is-eq caller sender) err-not-authorized)
    (asserts! (get is-paused stream-data) err-stream-not-paused)

    ;; Update stream state - only change is-active, uses current block as reference
    (map-set streams { stream-id: stream-id }
      (merge stream-data {
        is-paused: false,
        last-withdrawal-block: stacks-block-height,
      })
    )

    ;; Print resume-stream event
    (print {
      event: "resume-stream",
      stream-id: stream-id,
    })

    (ok true)
  )
)

;; Top-up an existing stream (only sender)
;; Adds additional funds to the deposit without changing other parameters
;; Transfer additional-amount from sender to contract
(define-public (top-up-stream
    (stream-id uint)
    (additional-amount uint)
    (token <ft-trait>)
  )
  (let (
      (stream-data (unwrap! (map-get? streams { stream-id: stream-id }) err-stream-not-found))
      (sender (get sender stream-data))
      (token-principal (get token stream-data))
      (caller tx-sender)
      (current-deposit (get deposit stream-data))
      (new-deposit (+ current-deposit additional-amount))
    )
    ;; Validation checks
    (asserts! (is-eq caller sender) err-not-authorized)
    (asserts! (is-eq (contract-of token) token-principal) err-invalid-token)
    (asserts! (> additional-amount u0) err-invalid-amount)
    (asserts! (<= (+ current-deposit additional-amount) max-deposit)
      err-invalid-amount
    )

    ;; Transfer additional funds from sender to contract
    (match (contract-call? token transfer additional-amount sender
      (as-contract tx-sender) none
    )
      success (begin
        ;; Update deposit amount only
        (map-set streams { stream-id: stream-id }
          (merge stream-data { deposit: new-deposit })
        )

        ;; Print top-up-stream event
        (print {
          event: "top-up-stream",
          stream-id: stream-id,
          sender: sender,
          additional-amount: additional-amount,
          new-deposit: new-deposit,
        })

        (ok new-deposit)
      )
      error err-transfer-failed
    )
  )
)
