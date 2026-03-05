class Kv < Formula
  desc "Secure API key storage via macOS Keychain"
  homepage "https://github.com/dxiongya/kv-cli"
  url "https://github.com/dxiongya/kv-cli/archive/refs/tags/v1.0.0.tar.gz"
  sha256 "9ff36b02578329646eca07d1c1517bd1b8fa08f99d6dd2709e8e315d828888ed"
  license "MIT"

  def install
    bin.install "bin/kv"
  end

  test do
    assert_match "kv v#{version}", shell_output("#{bin}/kv version")
  end
end
