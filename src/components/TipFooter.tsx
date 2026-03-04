type Props = {
  tipAmountInput: string;
  onSetTipAmount: (v: string) => void;
  onSendTip: () => void;
  isTipPending: boolean;
  tipTxHash?: string;
};

export function TipFooter({ tipAmountInput, onSetTipAmount, onSendTip, isTipPending, tipTxHash }: Props) {
  return (
    <footer className="tip-footer panel panel-dark">
      <p>
        built with <span className="tip-heart">♥</span> by klausblocks.eth. enjoying this utility? feel free to tip:
      </p>
      <div className="tip-row">
        <input name="tip-amount" aria-label="Tip amount" value={tipAmountInput} onChange={(e) => onSetTipAmount(e.target.value)} className="tip-input" />
        <button className="btn btn-primary" onClick={onSendTip} disabled={isTipPending}>
          THANKS!
        </button>
      </div>
      {tipTxHash ? <p className="muted">Tip sent: {tipTxHash}</p> : null}
    </footer>
  );
}
