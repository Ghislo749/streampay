;; ============================================================================
;; Mock USDCx Token for Testnet
;; ============================================================================
;; 
;; A simple SIP-010 compliant fungible token that mimics USDCx behavior
;; Includes a public mint function for testing purposes
;; 6 decimals to match real USDCx
;;
;; ============================================================================

;; SIP-010 trait testnet
;; SIP-010 trait mainnet : (impl-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)
(impl-trait 'ST1NXBK3K5YYMD6FD41MVNP3JS1GABZ8TRVX023PT.sip-010-trait-ft-standard.sip-010-trait)

;; Token definition
(define-fungible-token usdcx-token)

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-token-owner (err u101))

;; Token metadata
(define-constant token-name "Mock USDCx")
(define-constant token-symbol "USDCx")
(define-constant token-decimals u6)

;; SIP-010 Functions

(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
    (begin
        (asserts! (is-eq tx-sender sender) err-not-token-owner)
        (try! (ft-transfer? usdcx-token amount sender recipient))
        (match memo to-print (print to-print) 0x)
        (ok true)
    )
)

(define-read-only (get-name)
    (ok token-name)
)

(define-read-only (get-symbol)
    (ok token-symbol)
)

(define-read-only (get-decimals)
    (ok token-decimals)
)

(define-read-only (get-balance (who principal))
    (ok (ft-get-balance usdcx-token who))
)

(define-read-only (get-total-supply)
    (ok (ft-get-supply usdcx-token))
)

(define-read-only (get-token-uri)
    (ok (some u"https://ipfs.io/ipfs/bafkreifkhq47bgrlq2z2qgtps65eawgp6xsqkwldz57y2bjpefgo5zvza4"))
)

;; ============================================================================
;; TESTNET-ONLY: Public Mint Function
;; ============================================================================

;; This allows anyone to mint tokens for testing
(define-public (mint (amount uint) (recipient principal))
    (begin
        (try! (ft-mint? usdcx-token amount recipient))
        (ok true)
    )
)

;; Convenience function: mint 1000 USDCx to caller
(define-public (faucet)
    (begin
        (try! (ft-mint? usdcx-token u1000000000 tx-sender)) ;; 1000 USDCx = 1000 * 10^6
        (ok true)
    )
)