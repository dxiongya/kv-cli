class Kv < Formula
  desc "Secure API key storage via macOS Keychain"
  homepage "https://github.com/dxiongya/kv-cli"
  url "https://github.com/dxiongya/kv-cli/archive/refs/tags/v1.0.0.tar.gz"
  sha256 ""
  license "MIT"

  def install
    bin.install "bin/kv"
  end

  test do
    assert_match "kv v#{version}", shell_output("#{bin}/kv version")
  end
end
